module.exports = (req, res, next) => next();
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'secretkey';

function authMiddleware(req, res, next){
  const header = req.headers.authorization;
  // console.log("AUTH CHECK:", req.headers.authorization);

  if(!header) return res.status(401).json({ error: "Unauthorized" });
  const token = header.split(" ")[1];
  try{
    const payload = jwt.verify(token, process.env.JWT_SECRET || JWT_SECRET);
   
    req.user = payload;
    next();
  }catch(e){
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = authMiddleware;