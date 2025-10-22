// controllers/gemini.controller.js
const { getGeminiResponse } = require('../services/gemini.service');

// --- DATABASE INTERACTION ---
// Import các Mongoose model của bạn từ thư mục models
// Đảm bảo đường dẫn này chính xác với cấu trúc project của bạn
const Hotel = require('../models/hotelModel');
const Room = require('../models/roomModel');
const RoomType = require('../models/roomTypeModel');
const Service = require('../models/serviceModel');

/**
 * Hàm lấy dữ liệu khách sạn từ cơ sở dữ liệu.
 * @returns {Promise<Array>} Mảng các đối tượng khách sạn.
 */
async function getHotelsFromDB() {
  try {
    const hotels = await Hotel.find({})
      .populate('manager', 'name email') // Lấy thông tin manager
      .lean();
    return hotels;
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu khách sạn từ DB:', error);
    return [];
  }
}

/**
 * Hàm lấy dữ liệu phòng từ cơ sở dữ liệu.
 * @returns {Promise<Array>} Mảng các đối tượng phòng.
 */
async function getRoomsFromDB() {
  try {
    const rooms = await Room.find({})
      .populate('roomType', 'name description capacity basePrice numberOfBeds')
      .populate('hotel', 'name address')
      .lean();
    return rooms;
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu phòng từ DB:', error);
    return [];
  }
}

/**
 * Hàm lấy dữ liệu loại phòng từ cơ sở dữ liệu.
 * @returns {Promise<Array>} Mảng các đối tượng loại phòng.
 */
async function getRoomTypesFromDB() {
  try {
    const roomTypes = await RoomType.find({}).lean();
    return roomTypes;
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu loại phòng từ DB:', error);
    return [];
  }
}

/**
 * Hàm lấy dữ liệu dịch vụ từ cơ sở dữ liệu.
 * @returns {Promise<Array>} Mảng các đối tượng dịch vụ.
 */
async function getServicesFromDB() {
  try {
    const services = await Service.find({})
      .populate('hotel', 'name address')
      .lean();
    return services;
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu dịch vụ từ DB:', error);
    return [];
  }
}
// --- END DATABASE INTERACTION ---

/**
 * Hàm chuyển đổi văn bản Markdown cơ bản sang HTML.
 * Xử lý xuống dòng, in đậm và danh sách đơn giản.
 * @param {string} markdownText - Chuỗi văn bản có định dạng Markdown.
 * @returns {string} - Chuỗi văn bản đã được định dạng HTML.
 */
function convertMarkdownToHtml(markdownText) {
  let htmlText = markdownText;

  // 1. Chuyển đổi xuống dòng (\n) thành <br/>
  htmlText = htmlText.replace(/\n/g, '<br/>');

  // 2. Chuyển đổi in đậm (**) thành <strong>
  // Sử dụng regex với non-greedy match (.*?) để tránh match quá dài
  htmlText = htmlText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 3. Chuyển đổi danh sách (*) thành <ul><li>
  // Đây là một cách đơn giản, có thể cần regex phức tạp hơn cho các trường hợp lồng nhau
  // Tách thành các dòng để xử lý danh sách
  const lines = htmlText.split('<br/>');
  let inList = false;
  let processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith('* ')) {
      if (!inList) {
        processedLines.push('<ul>');
        inList = true;
      }
      // Loại bỏ dấu * và khoảng trắng đầu dòng, sau đó bọc trong <li>
      processedLines.push('<li>' + line.substring(2).trim() + '</li>');
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(line);
    }
  }
  if (inList) { // Đóng thẻ <ul> nếu danh sách kết thúc mà chưa đóng
    processedLines.push('</ul>');
  }

  htmlText = processedLines.join(''); // Nối lại các dòng

  return htmlText;
}


/**
 * Controller để xử lý yêu cầu chatbot từ người dùng.
 * Nó nhận prompt từ request body, lấy dữ liệu từ DB,
 * và gửi đến Gemini để nhận phản hồi.
 * @param {object} req - Đối tượng Request của Express.
 * @param {object} res - Đối tượng Response của Express.
 */
exports.askAIAboutGrandeHotel = async (req, res) => {
  const userPrompt = req.body.prompt; // Lấy prompt từ body của request

  if (!userPrompt) {
    return res.status(400).json({ error: 'Thiếu prompt từ người dùng' });
  }

  try {
    // Lấy tất cả dữ liệu cần thiết từ database một lần
    const hotels = await getHotelsFromDB();
    const rooms = await getRoomsFromDB();
    const roomTypes = await getRoomTypesFromDB();
    const services = await getServicesFromDB();

    let contextData = {};
    let systemInstruction = 'Bạn là một trợ lý ảo tư vấn thông tin cho khách sạn Grande Hotel. Hãy trả lời các câu hỏi về khách sạn, phòng, loại phòng và dịch vụ. Nếu không có thông tin, hãy nói rằng bạn không tìm thấy.';

    const lowerCaseQuery = userPrompt.toLowerCase();

    // Logic để xác định loại yêu cầu của người dùng
    if (lowerCaseQuery.includes('phòng') || lowerCaseQuery.includes('loại phòng') || lowerCaseQuery.includes('giá phòng')) {
      contextData = {
        rooms: rooms,
        roomTypes: roomTypes
      };
      systemInstruction = 'Bạn là một trợ lý ảo tư vấn về các loại phòng và phòng của khách sạn Grande Hotel. Hãy cung cấp thông tin chi tiết về các loại phòng, giá cả, mô tả, tiện nghi và trạng thái phòng. Nếu người dùng hỏi về một loại phòng cụ thể, hãy cố gắng cung cấp thông tin chi tiết về loại phòng đó. Nếu không có thông tin, hãy nói rằng bạn không tìm thấy.';
    } else if (lowerCaseQuery.includes('dịch vụ') || lowerCaseQuery.includes('service')) {
      contextData = services;
      systemInstruction = 'Bạn là một trợ lý ảo tư vấn về các dịch vụ của khách sạn Grande Hotel. Hãy cung cấp thông tin chi tiết về các dịch vụ, giá cả và mô tả. Nếu không có thông tin, hãy nói rằng bạn không tìm thấy.';
    } else if (lowerCaseQuery.includes('khách sạn') || lowerCaseQuery.includes('hotel') || lowerCaseQuery.includes('địa chỉ')) {
      contextData = hotels;
      systemInstruction = 'Bạn là một trợ lý ảo tư vấn về thông tin khách sạn Grande Hotel. Hãy cung cấp thông tin về tên, địa chỉ, liên hệ, mô tả và trạng thái của khách sạn. Nếu không có thông tin, hãy nói rằng bạn không tìm thấy.';
    } else {
      // Nếu không khớp với bất kỳ loại nào, cung cấp tất cả dữ liệu có thể và hướng dẫn AI trả lời tổng quát hơn.
      contextData = {
        hotels: hotels,
        rooms: rooms,
        roomTypes: roomTypes,
        services: services,
      };
      systemInstruction = 'Bạn là một trợ lý ảo tư vấn thông tin cho khách sạn Grande Hotel. Hãy trả lời các câu hỏi về khách sạn, phòng, loại phòng và dịch vụ dựa trên dữ liệu được cung cấp. Nếu không có thông tin cụ thể, hãy nói rằng bạn không tìm thấy và có thể hỏi thêm để làm rõ ý định của người dùng.';
    }

    // Gọi dịch vụ Gemini để lấy phản hồi
    const aiResponse = await getGeminiResponse(contextData, userPrompt, systemInstruction);

    // --- BƯỚC MỚI: Định dạng phản hồi để hiển thị đẹp trên UI ---
    const formattedResponse = convertMarkdownToHtml(aiResponse);
    // --- KẾT THÚC BƯỚC MỚI ---

    res.json({ answer: formattedResponse }); // Trả về phản hồi đã được định dạng HTML
  } catch (error) {
    console.error('🔥 Lỗi trong quá trình xử lý chatbot:', error);
    res.status(500).json({ error: 'Lỗi nội bộ khi xử lý yêu cầu chatbot.' });
  }
};
