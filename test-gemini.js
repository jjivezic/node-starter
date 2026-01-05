import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

console.log('Testing Gemini models...\n');
console.log('API Key:', process.env.GEMINI_API_KEY ? 'Found' : 'Missing', '\n');

// Test different model names (latest as of Dec 2024)
const modelsToTest = [
  'gemini-2.0-flash-exp',
  'gemini-exp-1206',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-flash', 
  'gemini-pro',
];

for (const modelName of modelsToTest) {
  try {
    console.log(`Trying ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Say hi');
    const response = await result.response;
    console.log(`✅ ${modelName} works!`);
    console.log(`Response: ${response.text()}\n`);
    break;
  } catch (error) {
    console.log(`❌ ${modelName} failed`);
    console.log(`   Error: ${error.message}\n`);
    if (error.message.includes('API_KEY') || error.message.includes('API key')) {
      console.log('⚠️  API Key issue detected!\n');
      break;
    }
  }
}
