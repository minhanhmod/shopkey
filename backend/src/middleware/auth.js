import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Bạn chưa đăng nhập"
      });
    }

    const token = header.substring(7);

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token không hợp lệ hoặc đã hết hạn"
    });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      message: "Bạn chưa đăng nhập"
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Bạn không có quyền admin"
    });
  }

  next();
}