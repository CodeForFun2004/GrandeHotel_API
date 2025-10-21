const Contact = require('../models/contact');

// @desc    Lấy tất cả contacts (có phân trang, lọc, sắp xếp)
// @route   GET /api/contacts
// @access  Private (Admin only)
const getContacts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Bộ lọc
    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    // Sắp xếp theo thời gian tạo, mới nhất trước
    const sort = { createdAt: -1 };

    const contacts = await Contact
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Contact.countDocuments(filter);

    res.json({
      results: contacts,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error getting contacts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Lấy contact theo ID
// @route   GET /api/contacts/:id
// @access  Private (Admin only)
const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Error getting contact:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Tạo contact mới (từ form frontend)
// @route   POST /api/contacts
// @access  Public
const createContact = async (req, res) => {
  try {
    const { name, email, phone, message, subject } = req.body;

    // Validate input
    if (!name || !email || !message) {
      return res.status(400).json({ 
        message: 'Name, email và message là bắt buộc'
      });
    }

    // Check email tồn tại không (tùy chọn)
    const existingContact = await Contact.findOne({ email, status: 'pending' });
    if (existingContact) {
      return res.status(400).json({ 
        message: 'Bạn đã gửi liên hệ đang chờ xử lý'
      });
    }

    const contact = new Contact({
      name,
      email,
      phone,
      message,
      subject,
      status: 'pending'
    });

    const savedContact = await contact.save();
    res.status(201).json(savedContact);

  } catch (error) {
    console.error('Error creating contact:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Cập nhật contact
// @route   PUT /api/contacts/:id
// @access  Private (Admin only)
const updateContact = async (req, res) => {
  try {
    const { name, email, phone, message, status, subject } = req.body;

    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    contact.name = name || contact.name;
    contact.email = email || contact.email;
    contact.phone = phone || contact.phone;
    contact.message = message || contact.message;
    contact.status = status || contact.status;
    contact.subject = subject || contact.subject

    const updatedContact = await contact.save();
    res.json(updatedContact);

  } catch (error) {
    console.error('Error updating contact:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Xóa contact
// @route   DELETE /api/contacts/:id
// @access  Private (Admin only)
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    await contact.deleteOne();
    res.json({ message: 'Contact removed' });

  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Lấy thống kê contacts (tùy chọn)
// @route   GET /api/contacts/stats
// @access  Private (Admin only)
const getContactsStats = async (req, res) => {
  try {
    const stats = await Contact.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await Contact.countDocuments();

    res.json({
      total,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, { pending: 0, processed: 0, ignored: 0 })
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  getContactsStats
};
