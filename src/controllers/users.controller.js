const { getPrismaClient } = require('../../prisma/client');
const prisma = getPrismaClient();

exports.createUser = async (req, res) => {
    console.time('createUser');
    console.log(`[CreateUser] Request received - ${new Date().toISOString()}`);
    const { userPhone, name } = req.body;

    if (!userPhone) {
        console.warn('[CreateUser] Missing required field: userPhone');
        console.timeEnd('createUser');
        return res.status(400).json({
            success: false,
            error: { message: "Phone number is required" }
        });
    }

    try {
        console.time('checkExistingUser');
        const existingUser = await prisma.user.findUnique({
            where: { phone: userPhone },
        });
        console.timeEnd('checkExistingUser');

        if (existingUser) {
            console.warn(`[CreateUser] User with phone ${userPhone} already exists`);
            console.timeEnd('createUser');
            return res.status(400).json({
                success: false,
                error: { message: "User with this phone number already exists" }
            });
        }

        console.time('createNewUser');
        const newUser = await prisma.user.create({
            data: {
                phone: userPhone,
                name: name || null,
            },
            select: {
                id: true,
                phone: true,
                name: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        console.timeEnd('createNewUser');

        console.log(`[CreateUser] Created user with ID: ${newUser.id}`);
        console.timeEnd('createUser');
        return res.status(201).json({
            success: true,
            data: {
                message: "User created successfully",
                user: newUser
            }
        });
    } catch (error) {
        console.error("[CreateUser] Error creating user:", error);
        console.timeEnd('createUser');
        return res.status(500).json({
            success: false,
            error: { message: "Error creating user", details: error.message }
        });
    }
};

exports.getUserByPhone = async (req, res) => {
    console.time('getUserByPhone');
    console.log(`[GetUserByPhone] Request received - ${new Date().toISOString()}`);

    try {
        const { userPhone } = req.query;
        console.log(`[GetUserByPhone] Query param userPhone: ${userPhone}`);

        // User should be attached by middleware
        const user = req.user;

        if (!user) {
            console.warn(`[GetUserByPhone] User not found for phone: ${userPhone}`);
            console.timeEnd('getUserByPhone');
            return res.status(404).json({
                success: false,
                error: { message: "User not found" }
            });
        }

        console.log(`[GetUserByPhone] Found user with ID: ${user.id}`);
        console.timeEnd('getUserByPhone');
        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error("[GetUserByPhone] Error fetching user:", error);
        console.timeEnd('getUserByPhone');
        return res.status(500).json({
            success: false,
            error: { message: "Error fetching user", details: error.message }
        });
    }
};
