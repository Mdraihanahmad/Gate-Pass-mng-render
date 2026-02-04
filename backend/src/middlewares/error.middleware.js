export const notFound = (req, res, next) => {
  res.status(404);
  res.json({ message: 'Not Found' });
};

export const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Server Error' });
};
