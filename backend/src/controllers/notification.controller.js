import Notification from '../models/Notification.js';
import User from '../models/User.js';

export const myNotifications = async (req, res, next) => {
  try {
    const items = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (e) {
    next(e);
  }
};

export const markRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
