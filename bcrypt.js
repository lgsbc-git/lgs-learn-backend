const bcrypt = require("bcryptjs");
bcrypt.hash("test123", 10).then(console.log);
