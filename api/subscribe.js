export default function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Return success for testing
  return res.status(200).json({
    success: true,
    message: 'API is working!',
    method: req.method,
    timestamp: Date.now()
  });
}
