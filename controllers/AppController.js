const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AppController {
  static getStatus(req, res) {
    const redisOnline = redisClient.isAlive();
    const dbOnline = dbClient.isAlive();
    if (redisOnline && dbOnline) {
      res.status = 200;
      res.json({ redis: true, db: true });
    }
  }

  static async getStats(req, res) {
    try {
      const users = await dbClient.nbUsers();
      const files = await dbClient.nbFiles();
      res.status(200);
      res.json({ users: `${users}`, files: `${files}` });
    } catch (error) {
      console.error(error);
    }
  }
}

module.exports = AppController;
