// Định dạng nội dung (docs/PLAN.md mục 1c). Thêm format mới = thêm 1 mục vào đây, không sửa pipeline.
export type Format = {
	id: string;
	// Cần văn bản nguồn (Wikipedia...) để chống bịa
	needsSource: boolean;
	// Hướng dẫn riêng cho người viết kịch bản
	writer: string;
	// Tiêu chí "chính xác" riêng cho QA
	accuracy: string;
};

export const FORMATS: Record<string, Format> = {
	'fun-fact': {
		id: 'fun-fact',
		needsSource: true,
		writer: `Định dạng FUN-FACT: một sự thật thú vị, bất ngờ về thế giới tự nhiên/khoa học/lịch sử.
- MỌI thông tin phải lấy từ NGUỒN bên dưới. Không thêm con số, tên riêng, chi tiết nào không có trong nguồn.
- Nếu chủ đề người dùng đưa có chi tiết sai so với nguồn, viết theo nguồn.
- Nếu NGUỒN không có thông tin trả lời đúng chủ đề: đặt "covered": false (vẫn điền các trường khác tối thiểu). KHÔNG lái sang chủ đề khác.
- Chọn 1 ý chính bất ngờ nhất, giải thích "vì sao" ngắn gọn, thêm 1–2 chi tiết phụ gây "wow".
- Liệt kê từng thông tin dùng trong kịch bản vào "facts", kèm câu trích NGUYÊN VĂN từ nguồn làm bằng chứng.`,
		accuracy: `Mỗi thông tin trong kịch bản phải có trong NGUỒN. Con số, tên, quan hệ nhân quả sai hoặc không có trong nguồn = bịa (điểm ≤ 2).
Kiểm tra "facts": câu trích phải thật sự có trong nguồn và đúng nghĩa với thông tin.`,
	},
	zodiac: {
		id: 'zodiac',
		needsSource: false,
		writer: `Định dạng ZODIAC: cung hoàng đạo & tâm lý vui, giọng hài hước, dễ đồng cảm ("đúng quá trời luôn!").
- Đây là nội dung GIẢI TRÍ: dùng cách nói như "người ta hay nói", "dân Cự Giải thường...", không khẳng định như khoa học.
- Không tiên tri về sức khoẻ, tiền bạc, tình duyên cụ thể; không chê bai nặng nề cung nào.
- Chú cua là Cự Giải, có thể tự nhận "Cua cũng là Cự Giải nè".
- "facts" để trống, "covered": true.`,
		accuracy: `Nội dung chiêm tinh là giải trí: không được trình bày như sự thật khoa học, không tiên tri sức khoẻ/tài chính, không gây hiểu lầm.
Đặc điểm gán cho các cung phải đúng với quan niệm chiêm tinh phổ biến (vd Cự Giải: tình cảm, nhạy cảm, gắn bó gia đình).`,
	},
};

export const getFormat = (id: string) => {
	const f = FORMATS[id];
	if (!f) throw new Error(`Không có format "${id}". Có: ${Object.keys(FORMATS).join(', ')}`);
	return f;
};
