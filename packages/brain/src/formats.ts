// Định dạng nội dung (docs/PLAN.md mục 1c). Thêm format mới = thêm 1 mục vào đây, không sửa pipeline.
export type Format = {
	id: string;
	// Cần văn bản nguồn (Wikipedia...) để chống bịa
	needsSource: boolean;
	// Hướng dẫn riêng cho người viết kịch bản
	writer: string;
	// Tiêu chí "chính xác" riêng cho QA
	accuracy: string;
	// Thông tin cơ bản bắt buộc phải có trong lời thoại (QA chấm tiêu chí "essentials")
	essentials: string;
};

export const FORMATS: Record<string, Format> = {
	'fun-fact': {
		id: 'fun-fact',
		needsSource: true,
		writer: `Định dạng FUN-FACT: một sự thật thú vị, bất ngờ về thế giới tự nhiên/khoa học/lịch sử.
- MỌI thông tin phải lấy từ NGUỒN bên dưới. Không thêm con số, tên riêng, chi tiết nào không có trong nguồn.
- Nếu chủ đề người dùng đưa có chi tiết sai so với nguồn, viết theo nguồn.
- Nếu NGUỒN không có thông tin trả lời đúng chủ đề: đặt "covered": false (vẫn điền các trường khác tối thiểu). KHÔNG lái sang chủ đề khác.
- THÔNG TIN CƠ BẢN (bắt buộc, nói trong 3 câu đầu, ngay sau hook): người xem phải biết ĐÓ LÀ GÌ —
  gọi đúng TÊN của đối tượng (tên tiếng Việt phổ biến; không có thì tên tiếng Anh/tên gốc), nó Ở ĐÂU (nước, vùng, môi trường sống)
  và 1 con số nhận dạng nếu nguồn có (kích thước, cân nặng, tuổi thọ, năm phát hiện...). Đừng chỉ gọi "loài hoa này", "loài cây đó" suốt video.
- Điền "subject": tên gọi, tên khoa học (nếu là sinh vật và nguồn có), nơi sống/xuất hiện — lấy từ nguồn. Tên khoa học KHÔNG cần đọc trong lời thoại (giọng đọc tiếng Việt đọc tiếng Latin rất khó nghe), nó sẽ ghi trong mô tả video.
- Chọn 1 ý chính bất ngờ nhất, giải thích "vì sao" ngắn gọn, thêm 1–2 chi tiết phụ gây "wow".
- Liệt kê từng thông tin dùng trong kịch bản vào "facts", kèm câu trích NGUYÊN VĂN từ nguồn làm bằng chứng.`,
		accuracy: `Mỗi thông tin trong kịch bản phải có trong NGUỒN. Con số, tên, quan hệ nhân quả sai hoặc không có trong nguồn = bịa (điểm ≤ 2).
Kiểm tra "facts": câu trích phải thật sự có trong nguồn và đúng nghĩa với thông tin.`,
		essentials: `Xem xong người xem phải trả lời được: nó TÊN là gì (gọi đúng tên ít nhất 1 lần trong lời thoại, không chỉ "loài này"), nó Ở ĐÂU / sống ở đâu (nếu nguồn có).
Thiếu tên → ≤ 2. Có tên nhưng thiếu nơi sống/xuất hiện mà nguồn có ghi → 3. Có thêm 1 con số nhận dạng (kích thước, cân nặng...) → 5.`,
	},
	zodiac: {
		id: 'zodiac',
		needsSource: false,
		writer: `Định dạng ZODIAC: cung hoàng đạo & tâm lý vui, giọng hài hước, dễ đồng cảm ("đúng quá trời luôn!").
- Đây là nội dung GIẢI TRÍ: dùng cách nói như "người ta hay nói", "dân Cự Giải thường...", không khẳng định như khoa học.
- Không tiên tri về sức khoẻ, tiền bạc, tình duyên cụ thể; không chê bai nặng nề cung nào.
- Chú cua là Cự Giải, có thể tự nhận "Cua cũng là Cự Giải nè".
- Nói rõ cung nào (tên cung + khoảng ngày sinh nếu hợp, vd "Cự Giải, sinh từ 22/6 đến 22/7") để người xem tự nhận ra mình.
- "facts" để trống, "covered": true; "subject": tên cung (các trường khác để trống).`,
		accuracy: `Nội dung chiêm tinh là giải trí: không được trình bày như sự thật khoa học, không tiên tri sức khoẻ/tài chính, không gây hiểu lầm.
Đặc điểm gán cho các cung phải đúng với quan niệm chiêm tinh phổ biến (vd Cự Giải: tình cảm, nhạy cảm, gắn bó gia đình).`,
		essentials: `Lời thoại phải gọi đúng tên các cung được nói tới (không chỉ "cung này"). Thiếu tên cung → ≤ 2.`,
	},
};

export const getFormat = (id: string) => {
	const f = FORMATS[id];
	if (!f) throw new Error(`Không có format "${id}". Có: ${Object.keys(FORMATS).join(', ')}`);
	return f;
};
