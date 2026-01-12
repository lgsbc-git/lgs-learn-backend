const { loginUser } = require("./auth.service");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const result = await loginUser(email, password);

    res.status(200).json(result);
  } catch (err) {
    res.status(401).json({
      message: err.message || "Invalid credentials",
    });
  }
};

module.exports = {
  login,
};
