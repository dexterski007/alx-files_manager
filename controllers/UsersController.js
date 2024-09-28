import sha1 from 'sha1';
import Queue from 'bull/lib/queue';
import ObjectId from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const uQueue = new Queue('userController');

class UserController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    const userCheck = await dbClient.dbClient.collection('users').findOne({ email });
    if (userCheck) {
      return res.status(400).json({ error: 'Already exist' });
    }
    const hashed = sha1(password);
    const reply = await dbClient.dbClient.collection('users').insertOne({ email, password: hashed });
    const userIdres = reply.insertedId;
    uQueue.add({ userId: userIdres });
    return res.status(201).json({ id: userIdres, email });
  }

  static async getMe(req, res) {
    const token = req.header('X-Token');
    const reply = await redisClient.get(`auth_${token}`);
    if (!reply) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const objId = new ObjectId(reply);
    const user = await dbClient.dbClient.collection('users').findOne({ _id: objId });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(200).json({ id: reply, email: user.email });
  }
}

module.exports = UserController;
