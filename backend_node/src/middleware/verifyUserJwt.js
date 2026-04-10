const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET || "ChuoiBiMatCuaBan123!";

/**
 * Yêu cầu Bearer JWT (sau firebase-verify). Gắn Firebase UID vào req.firebaseUid.
 */
function verifyUserJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Cần đăng nhập để dùng chat AI." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const uid = decoded?.id;
    if (!uid) {
      return res.status(401).json({ message: "Token không chứa định danh người dùng." });
    }
    req.firebaseUid = uid;
    return next();
  } catch {
    return res.status(401).json({ message: "Phiên đăng nhập hết hạn hoặc không hợp lệ." });
  }
}

module.exports = { verifyUserJwt };
