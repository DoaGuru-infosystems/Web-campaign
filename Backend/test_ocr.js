const { extractAadharDetails } = require('./utils/aadharParser');
(async () => {
  console.log('Testing...');
  const testImg = 'C:/Users/HITS/.gemini/antigravity-ide/brain/14636a29-33cd-4f27-9176-56fed6b568da/.user_uploaded/media_1789646893670.png';
  const result = await extractAadharDetails(testImg);
  console.log('OCR Result:', JSON.stringify(result, null, 2));
})().catch(e => {
  console.error('FAILED:', e);
});
