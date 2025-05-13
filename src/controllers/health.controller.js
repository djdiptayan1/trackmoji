const os = require('os');
const { execSync } = require('child_process');
const { getPrismaClient } = require('../../prisma/client');
const prisma = getPrismaClient();
const axios = require('axios');

// Start time for uptime calculation
const startTime = Date.now();

/**
 * Health check controller
 * Returns comprehensive health information about the system and application
 */
exports.healthCheck = async (req, res) => {
    try {
        // Basic application status
        const healthInfo = {
            status: "ok",
            message: "API is running 🚀",
            timestamp: new Date().toISOString()
        };

        // System information
        const systemInfo = {
            platform: process.platform,
            architecture: process.arch,
            nodeVersion: process.version,
            hostname: os.hostname(),
            cpuCores: {
                physical: os.cpus().length,
                // In Node.js, we can only get logical cores
                logical: os.cpus().length
            },
            bootTime: new Date(Date.now() - os.uptime() * 1000).toISOString()
        };

        // Resource usage
        try {
            const resourceInfo = {
                cpuUsagePercent: getCpuUsage(),
                memory: {
                    total: os.totalmem(),
                    available: os.freemem(),
                    used: os.totalmem() - os.freemem(),
                    percent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
                },
                disk: getDiskUsage(),
                pid: process.pid,
                processMemoryInfo: process.memoryUsage()
            };
            healthInfo.resources = resourceInfo;
        } catch (err) {
            healthInfo.resources = { error: err.message };
        }

        // Application uptime
        const uptimeSeconds = (Date.now() - startTime) / 1000;
        healthInfo.uptime = formatUptime(uptimeSeconds);

        // Add system info to the response
        healthInfo.system = systemInfo;

        // Database connectivity check
        try {
            const dbResult = await prisma.$queryRaw`SELECT 1 as result`;
            healthInfo.database = {
                status: "connected",
                message: "Database connection successful",
                result: dbResult
            };
        } catch (err) {
            healthInfo.database = {
                status: "disconnected",
                message: err.message
            };
        }

        // External API check
        try {
            const response = await axios.get('https://djdiptayan.in/shelfspace/api', { timeout: 2000 });
            healthInfo.externalApi = {
                status: response.status === 200 ? "connected" : "error",
                message: `External API returned ${response.status}`
            };
        } catch (err) {
            healthInfo.externalApi = {
                status: "disconnected",
                message: err.message
            };
        }

        return res.status(200).json(healthInfo);
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Failed to retrieve health information",
            error: error.message
        });
    }
};

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Get CPU usage using child_process
 */
function getCpuUsage() {
    try {
        // This is a platform-specific approach
        if (process.platform === 'darwin') {
            const cpuUsage = execSync("ps -A -o %cpu | awk '{s+=$1} END {print s}'")
                .toString()
                .trim();
            return parseFloat(cpuUsage).toFixed(2);
        } else if (process.platform === 'linux') {
            const cpuUsage = execSync("grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {print usage}'")
                .toString()
                .trim();
            return parseFloat(cpuUsage).toFixed(2);
        } else {
            return "N/A";
        }
    } catch (e) {
        return "N/A";
    }
}

/**
 * Get disk usage using child_process
 */
function getDiskUsage() {
    try {
        if (process.platform === 'darwin' || process.platform === 'linux') {
            const diskData = execSync("df -h / | awk 'NR==2{print $2,$3,$4,$5}'")
                .toString()
                .trim()
                .split(' ');

            return {
                total: diskData[0],
                used: diskData[1],
                free: diskData[2],
                percent: diskData[3]
            };
        } else {
            return { error: "Disk usage check not supported on this platform" };
        }
    } catch (e) {
        return { error: e.message };
    }
}