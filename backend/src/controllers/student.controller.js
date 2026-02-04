import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import Log from '../models/Log.js';
import mongoose from 'mongoose';
import multer from 'multer';
import streamifier from 'streamifier';
import cloudinary from '../config/cloudinary.js';

export const myProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
    const profile = await StudentProfile.findOne({ user: user._id }).lean();
    res.json({
      registrationNo: user.registrationNo,
      isApproved: user.isApproved,
  requestedApproval: user.requestedApproval,
      name: profile?.name,
      branch: profile?.branch,
      batchYear: profile?.batchYear,
  qrCodeDataUrl: user.isApproved ? profile?.qrCodeDataUrl : null,
  pinCode: user.pinCode || null,
  profilePhotoUrl: user.profilePhotoUrl || null,
  profilePhotoLocked: !!user.profilePhotoLocked,
    });
  } catch (e) {
    next(e);
  }
};

export const myLogs = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
    const logs = await Log.find({ registrationNo: user.registrationNo }).sort({ timestamp: -1 }).lean();
    res.json(logs);
  } catch (e) {
    next(e);
  }
};

// Upload or replace student profile photo
export const uploadProfilePhoto = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const mime = req.file.mimetype || '';
    if (!mime.startsWith('image/')) return res.status(400).json({ message: 'Only image files are allowed' });

    // After approval, photo cannot be uploaded/changed at all
    if (user.isApproved) {
      return res.status(400).json({ message: 'Profile photo cannot be changed after approval' });
    }

    // Upload new image (allow replacing pre-approval). If there is an existing public id and user not approved yet, delete old.
    if (!user.isApproved && user.profilePhotoPublicId) {
      try { await cloudinary.uploader.destroy(user.profilePhotoPublicId); } catch {}
    }

    const folder = 'gatepass/profile_photos';
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          overwrite: true,
          invalidate: true,
          transformation: [{ width: 512, height: 512, crop: 'limit', quality: 'auto' }],
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });

  user.profilePhotoUrl = uploadResult.secure_url;
  user.profilePhotoPublicId = uploadResult.public_id;
    await user.save();
    return res.json({ message: 'Profile photo saved', profilePhotoUrl: user.profilePhotoUrl, profilePhotoLocked: !!user.profilePhotoLocked });
  } catch (e) { next(e); }
};

// Update draft student identity fields prior to approval (name, registrationNo)
export const updateStudentDraft = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
    if (user.isApproved) return res.status(400).json({ message: 'Already approved; cannot modify identity fields' });
    const { name, registrationNo } = req.body || {};
    if (registrationNo && typeof registrationNo === 'string' && registrationNo.trim()) {
      const exists = await User.exists({ _id: { $ne: user._id }, registrationNo: registrationNo.trim() });
      if (exists) return res.status(409).json({ message: 'Registration number already in use' });
      user.registrationNo = registrationNo.trim();
    }
    // Ensure profile exists
    let profile = await StudentProfile.findOne({ user: user._id });
    if (!profile) {
      return res.status(400).json({ message: 'Student profile missing; contact admin' });
    }
    if (name && typeof name === 'string' && name.trim()) {
      profile.name = name.trim();
    }
    await Promise.all([user.save(), profile.save()]);
    res.json({ message: 'Updated draft', registrationNo: user.registrationNo, name: profile.name });
  } catch (e) { next(e); }
};

export const requestApproval = async (req, res, next) => {
  try {
  const user = await User.findById(req.user.id);
  if (!user || user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
  if (user.isApproved) return res.status(400).json({ message: 'Already approved' });
  if (user.requestedApproval) return res.json({ message: 'Already requested' });
  user.requestedApproval = true;
  user.approvalRequestedAt = new Date();
  await user.save();
  res.json({ message: 'Approval request sent' });
  } catch (e) {
    next(e);
  }
};

// Allow a student to set/change their 6-digit PIN
export const changePin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
    if (!user.isApproved) return res.status(400).json({ message: 'Not approved yet' });
    const { newPin, oldPin } = req.body || {};
    if (typeof newPin !== 'string' || !/^\d{6}$/.test(newPin)) {
      return res.status(400).json({ message: 'PIN must be exactly 6 digits' });
    }
    // Optional: require oldPin match if a pin already exists
    if (user.pinCode && (typeof oldPin !== 'string' || oldPin !== user.pinCode)) {
      return res.status(400).json({ message: 'Current PIN is incorrect' });
    }
    // Ensure uniqueness across users to avoid ambiguity at gate
    const exists = await User.exists({ _id: { $ne: user._id }, pinCode: newPin });
    if (exists) return res.status(409).json({ message: 'PIN already in use. Pick a different one.' });
    user.pinCode = newPin;
    await user.save();
    return res.json({ message: 'PIN updated', pinCode: user.pinCode });
  } catch (e) {
    next(e);
  }
};
