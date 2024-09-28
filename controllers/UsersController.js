import sha1 from 'sha1';
import Queue from 'bull/lib/queue';
import dbClient from '../utils/db';

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
}

module.exports = UserController;
