import { ChromaClient } from 'chromadb';
import geminiService from './geminiService.js';
import logger from '../config/logger.js';

/**
 * Vector Database Service using ChromaDB
 * Handles document storage, embeddings, and semantic search
 */
class VectorService {
  constructor() {
    this.client = null;
    this.collection = null;
    this.collectionName = 'documents';
  }

  /**
   * Initialize ChromaDB client and collection
   */
  async initialize() {
    try {
      if (this.client && this.collection) {
        logger.info('ChromaDB already initialized');
        return;
      }

      logger.info('Initializing ChromaDB client...');
      this.client = new ChromaClient({
        path: 'http://localhost:8000'
      });

      // Try to get existing collection or create new one
      try {
        this.collection = await this.client.getCollection({
          name: this.collectionName,
          embeddingFunction: undefined // We provide embeddings manually via Gemini
        });
        logger.info(`Connected to existing collection: ${this.collectionName}`);
      } catch (error) {
        logger.warn('Collection not found, trying to create:', error.message);
        try {
          this.collection = await this.client.createCollection({
            name: this.collectionName,
            metadata: { description: 'Document embeddings for RAG' },
            embeddingFunction: undefined // We provide embeddings manually via Gemini
          });
          logger.info(`Created new collection: ${this.collectionName}`);
        } catch (createError) {
          // If resource already exists, get the collection
          if (createError.message && createError.message.includes('already exists')) {
            logger.warn('Collection already exists, fetching existing collection.');
            this.collection = await this.client.getCollection({
              name: this.collectionName,
              embeddingFunction: undefined // We provide embeddings manually via Gemini
            });
            logger.info(`Connected to existing collection: ${this.collectionName}`);
          } else {
            throw createError;
          }
        }
      }

      logger.info('ChromaDB initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ChromaDB:', error);
      logger.error('Make sure ChromaDB server is running: chroma run --path ./chroma_data');
      throw new Error(`ChromaDB initialization failed: ${error.message}`);
    }
  }

  /**
   * Add documents to the vector database
   * @param {Array} documents - Array of document objects {id, text, metadata}
   */
  async addDocuments(documents) {
    try {
      // Ensure ChromaDB is initialized
      await this.initialize();

      logger.info(`Adding ${documents.length} documents to ChromaDB`);

      // Create embeddings for all documents using Gemini
      const embeddings = [];
      for (const doc of documents) {
        const embedding = await geminiService.createEmbedding(doc.text);
        embeddings.push(embedding);
      }

      // Prepare data for ChromaDB
      const ids = documents.map((doc) => doc.id);
      const texts = documents.map((doc) => doc.text);
      const metadatas = documents.map((doc) => doc.metadata || {});

      // Add to ChromaDB
      await this.collection.add({
        ids,
        documents: texts,
        embeddings,
        metadatas
      });

      logger.info(`Successfully added ${documents.length} documents`);

      return {
        success: true,
        count: documents.length,
        ids
      };
    } catch (error) {
      logger.error('Failed to add documents:', error);
      throw new Error(`Failed to add documents: ${error.message}`);
    }
  }

  /**
   * Search for similar documents using semantic search
   * @param {string} query - Search query
   * @param {number} nResults - Number of results to return
   * @param {string} keyword - Optional keyword to filter results (exact text match)
   * @param {number} maxDistance - Optional max distance threshold (lower = more similar)
   */
  async search(query, nResults = 5, keyword = null, maxDistance = 1) {
    console.log('VectorService.search called with query:', query, 'nResults:', nResults, 'keyword:', keyword, 'maxDistance:', maxDistance);
    try {
      if (!this.collection) {
        await this.initialize();
      }

      // Create embedding for query using Gemini
      const queryEmbedding = await geminiService.createEmbedding(query);

      // Search in ChromaDB
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: keyword ? nResults * 3 : nResults // Get more results if filtering by keyword
      });

      logger.info(`Found ${results.ids[0].length} results`);

      // Format results
      let formattedResults = results.ids[0].map((id, index) => {
        const metadata = results.metadatas[0][index];
        const mimeType = metadata?.mimeType || '';
        
        // Generate Google Drive/Docs link based on mimeType
        let googleLink = '';
        if (mimeType === 'application/vnd.google-apps.document') {
          googleLink = `https://docs.google.com/document/d/${id}`;
        } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
          googleLink = `https://docs.google.com/spreadsheets/d/${id}`;
        } else if (mimeType === 'application/vnd.google-apps.presentation') {
          googleLink = `https://docs.google.com/presentation/d/${id}`;
        } else {
          googleLink = `https://drive.google.com/file/d/${id}`;
        }
        
        return {
          id,
          text: results.documents[0][index],
          metadata: metadata,
          distance: results.distances[0][index],
          path: metadata?.folderPath + '/x/' + metadata?.name || 'unknown',
          googleLink
        };
      });

      // Filter by keyword if provided (case-insensitive)
      if (keyword) {
        const keywordLower = keyword.toLowerCase();
        formattedResults = formattedResults.filter((doc) => doc.text.toLowerCase().includes(keywordLower));
        logger.info(`After keyword filter "${keyword}": ${formattedResults.length} results`);
      }

      // Filter by distance threshold if provided
      if (maxDistance !== null && maxDistance !== undefined) {
        formattedResults = formattedResults.filter((doc) => doc.distance <= maxDistance);
        logger.info(`After distance filter (<= ${maxDistance}): ${formattedResults.length} results`);
      }

      // Limit to requested number
      formattedResults = formattedResults.slice(0, nResults);

      return formattedResults;
    } catch (error) {
      logger.error('Search failed:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Delete documents by IDs
   * @param {Array} ids - Array of document IDs to delete
   */
  async deleteDocuments(ids) {
    try {
      // Ensure ChromaDB is initialized
      if (!this.collection) {
        await this.initialize();
      }

      await this.collection.delete({
        ids
      });

      logger.info(`Successfully deleted ${ids.length} documents`);

      return {
        success: true,
        count: ids.length
      };
    } catch (error) {
      logger.error('Failed to delete documents:', error);
      throw new Error(`Failed to delete documents: ${error.message}`);
    }
  }

  /**
   * Get all documents in the collection
   */
  async getAllDocuments() {
    try {
      // Ensure ChromaDB is initialized
      await this.initialize();

      logger.info('Getting all documents from ChromaDB');

      const results = await this.collection.get();

      logger.info(`Retrieved ${results.ids.length} documents`);

      return {
        count: results.ids.length,
        documents: results.ids.map((id, index) => ({
          id,
          text: results.documents[index],
          metadata: results.metadatas[index]
        }))
      };
    } catch (error) {
      logger.error('Failed to get documents:', error);
      throw new Error(`Failed to get documents: ${error.message}`);
    }
  }

  /**
   * Get collection stats
   */
  async getStats() {
    try {
      await this.initialize();

      const count = await this.collection.count();

      return {
        collectionName: this.collectionName,
        documentCount: count
      };
    } catch (error) {
      logger.error('Failed to get stats:', error);
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  /**
   * Reset collection (delete all documents)
   */
  async reset() {
    try {
      // Ensure ChromaDB is initialized
      if (!this.collection) {
        await this.initialize();
      }

      logger.info('Resetting collection...');

      await this.initialize();
      // Create new collection
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: { description: 'Document embeddings for RAG' }
      });

      logger.info('Collection reset successfully');

      return {
        success: true,
        message: 'Collection reset successfully'
      };
    } catch (error) {
      logger.error('Failed to reset collection:', error);
      throw new Error(`Failed to reset collection: ${error.message}`);
    }
  }
}

export default new VectorService();
