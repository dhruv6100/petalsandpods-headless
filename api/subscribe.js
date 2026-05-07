export default function handler(req, res) {
  console.log("API hit:", req.method);
  
  res.status(200).json({
    success: true,
    message: "Test API working",
    method: req.method,
    time: new Date().toISOString()
  });
}
