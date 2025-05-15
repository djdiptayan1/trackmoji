const { getPrismaClient } = require('../../prisma/client');
const prisma = getPrismaClient();

exports.createUser = async (req, res) => {
    const { userPhone, name } = req.body;

    // Validate required fields
    if (!userPhone) {
        return res.status(400).json({
            success: false,
            error: { message: "Phone number is required" }
        });
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { phone: userPhone },
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: { message: "User with this phone number already exists" }
            });
        }

        const newUser = await prisma.user.create({
            data: {
                phone: userPhone,
                name: name || null // Handle case where name might not be provided
            },
            select: {
                id: true,
                phone: true,
                name: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        console.log(`[CreateUser] Created user with ID: ${newUser.id}`);
        res.status(201).json({
            success: true,
            data: {
                message: "User created successfully",
                user: newUser
            }
        });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({
            success: false,
            error: { message: "Error creating user", details: error.message }
        });
    }
};

exports.getUserByPhone = async (req, res) => {
    try {
        // Extract userPhone from query parameters for GET request
        const { userPhone } = req.query;

        console.log(`[GetUserByPhone] Requested user with phone: ${userPhone}`);

        // User should be attached by the middleware
        const user = req.user;
        if (!user) {
            return res.status(404).json({
                success: false,
                error: { message: "User not found" }
            });
        }

        console.log(`[GetUserByPhone] Retrieved user with ID: ${user.id}`);
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({
            success: false,
            error: { message: "Error fetching user", details: error.message }
        });
    }
};
