const { getPrismaClient } = require('../../prisma/client');
const prisma = getPrismaClient();

const checkUserExists = async (req, res, next) => {
    // Get userPhone from req.body (POST), req.params (GET with URL params), or req.query (GET with query params)
    let userPhone = req.body?.userPhone || req.query?.userPhone;

    if (!userPhone) {
        return res.status(400).json({
            success: false,
            error: { message: "Missing required field: userPhone" }
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { phone: userPhone },
            // select: { id: true, phone: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { message: "User not found. Please register first." }
            });
        }

        req.user = user; // Attach user info to request
        next(); // Proceed to the controller
    } catch (error) {
        console.error("Error in checkUserExists middleware:", error);
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
};

module.exports = checkUserExists;