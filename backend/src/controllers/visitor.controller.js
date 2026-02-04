import Visitor from '../models/Visitor.js';
import cloudinary from '../config/cloudinary.js';

export const createVisitor = async (req, res, next) => {
  try {
    const { name, vehicleNo, purpose, entryTime } = req.body;
    if (!name || !purpose) return res.status(400).json({ message: 'Missing fields' });
    const uploadBuffer = (buffer) => new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'gatepass/visitors',
          resource_type: 'image',
          format: 'jpg',
          quality: 'auto',
          transformation: [{ width: 720, height: 720, crop: 'limit' }],
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
      stream.end(buffer);
    });

    const picked = [];
    // Backward compatible: multer.single('photo') or fields('photo')
    if (req.file?.buffer) picked.push(req.file);
    const f = req.files || {};
    if (Array.isArray(f.photo) && f.photo[0]?.buffer) picked.push(f.photo[0]);
    if (Array.isArray(f.photos)) {
      for (const file of f.photos) {
        if (file?.buffer) picked.push(file);
      }
    }

    const limited = picked.slice(0, 3);
    const uploaded = limited.length ? await Promise.all(limited.map((file) => uploadBuffer(file.buffer))) : [];
    const photos = uploaded.map((r) => ({ url: r.secure_url, publicId: r.public_id }));
    const photoUrl = photos[0]?.url || null;
    const photoPublicId = photos[0]?.publicId || null;

    const v = await Visitor.create({
      name,
      vehicleNo,
      purpose,
      entryTime: entryTime ? new Date(entryTime) : new Date(),
      createdBy: req.user.id,
      photoUrl,
      photoPublicId,
      photos,
    });
    res.status(201).json(v);
  } catch (e) {
    next(e);
  }
};

export const updateVisitorExit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { exitTime } = req.body;
    const v = await Visitor.findByIdAndUpdate(id, { exitTime: exitTime ? new Date(exitTime) : new Date() }, { new: true });
    if (!v) return res.status(404).json({ message: 'Visitor not found' });
    res.json(v);
  } catch (e) {
    next(e);
  }
};

export const listVisitors = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const q = {};
    if (from || to) q.entryTime = {};
    if (from) q.entryTime.$gte = new Date(from);
    if (to) q.entryTime.$lte = new Date(to);
    const visitors = await Visitor.find(q).sort({ entryTime: -1 }).lean();
    res.json(visitors);
  } catch (e) {
    next(e);
  }
};
