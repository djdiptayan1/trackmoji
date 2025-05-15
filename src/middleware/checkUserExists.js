const { getPrismaClient } = require('../../prisma/client');
const prisma = getPrismaClient();

const checkUserExists = async (req, res, next) => {
    console.time('checkUserExists');
    console.log(`[CheckUserExists] Started - ${new Date().toISOString()}`);

    // Get userPhone from req.body (POST) or req.query (GET)
    const userPhone = req.body?.userPhone || req.query?.userPhone;

    if (!userPhone) {
        console.warn('[CheckUserExists] Missing required field: userPhone');
        console.timeEnd('checkUserExists');
        return res.status(400).json({
            success: false,
            error: { message: "Missing required field: userPhone" }
        });
    }

    console.log(`[CheckUserExists] Looking up user with phone: ${userPhone}`);

    try {
        console.time('dbUserLookup');
        const user = await prisma.user.findUnique({
            where: { phone: userPhone },
        });
        console.timeEnd('dbUserLookup');

        if (!user) {
            console.warn(`[CheckUserExists] User not found for phone: ${userPhone}`);
            console.timeEnd('checkUserExists');
            return res.status(404).json({
                success: false,
                error: { message: "User not found. Please register first." }
            });
        }

        req.user = user; // Attach user info to request
        console.log(`[CheckUserExists] User found with ID: ${user.id}`);
        console.timeEnd('checkUserExists');
        next();
    } catch (error) {
        console.error("[CheckUserExists] Internal server error:", error);
        console.timeEnd('checkUserExists');
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
};

module.exports = checkUserExists;
