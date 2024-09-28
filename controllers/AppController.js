import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AppController {
  static getStatus(req, res) {
    const redisOnline = redisClient.isAlive();
    const dbOnline = dbClient.isAlive();
    res.status(200).json({ redis: redisOnline, db: dbOnline });
  }

  static async getStats(req, res) {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    res.status(200).json({ users: users, files: files });
  }
}

export default AppController;
