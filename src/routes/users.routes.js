const express = require('express');
const userController = require('../controllers/users.controller');
const router = express.Router();

const checkUserExists = require('../middleware/checkUserExists');

router.post('/', userController.createUser);
router.get('/search', checkUserExists, userController.getUserByPhone);

module.exports = router;