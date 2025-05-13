const { app, shutdown } = require('./src/app');

const PORT = process.env.PORT || 3010;

// Start the server
const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`API documentation available at http://localhost:${PORT}/api-docs`);
    console.log(`Root access: http://localhost:${PORT}/`);
});
module.exports = server; 