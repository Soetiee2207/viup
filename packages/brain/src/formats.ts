// Định dạng nội dung (docs/PLAN.md mục 1c). Thêm format mới = thêm 1 mục vào đây, không sửa pipeline.
export type Format = {
	id: string;
	// Cần văn bản nguồn (Wikipedia...) để chống bịa
	needsSource: boolean;
	// Kể chuyện hội thoại có nhân vật khách (guest) giọng riêng
	story: boolean;
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
		story: true,
		writer: `Định dạng FUN-FACT KỂ CHUYỆN: một sự thật thú vị kể thành MẨU CHUYỆN HỘI THOẠI vui giữa Cua và NHÂN VẬT KHÁCH.
NHÂN VẬT KHÁCH ("guest") = chính đối tượng của chủ đề (con vật, đồ vật, món ăn, bộ phận cơ thể, hiện tượng...) được NHÂN HOÁ: có tính cách riêng (kiêu, than thở, tự hào, ngại ngùng, láu cá...), xưng "tui"/"tớ"/"ta", tự kể chuyện của chính mình.
- guest.icon: tên icon trong DANH SÁCH ICON thể hiện đúng nhân vật (vd heo: pig-face, xúc xích: hot-dog). guest.name: tên gọi ngắn ≤ 14 ký tự (vd "Heo Mẹ", "Anh Xúc Xích"). guest.voice: nu | tram | be — hợp tính cách.
- Mỗi câu có "speaker": "crab" (Cua: tò mò, hỏi, nghi ngờ, phản ứng hài) hoặc "guest" (khách: kể, giải thích, than, khoe). Khách nói ít nhất 1/3 số câu.

CẤU TRÚC (9–14 câu, tổng 120–175 chữ ≈ 45–60 giây, mỗi câu ≤ 22 chữ — câu thoại ngắn, tự nhiên như nói chuyện):
1. Câu 1 = HOOK 3 giây: câu hỏi đời thường gây tò mò hoặc khẳng định gây sốc (Cua hoặc khách nói).
2. Khách xuất hiện, tự giới thiệu: TÊN + Ở ĐÂU (theo nguồn) theo cách hài hước, có tính cách.
3. Giữa: Cua hỏi / nghi ngờ / đoán sai → khách giải thích "vì sao" bằng chuyện của chính mình, có chút xung đột, than thở hoặc khoe khoang; 1 con số nhận dạng.
4. Twist / chi tiết "wow" bất ngờ nhất.
5. Câu chốt hài (punchline) của khách hoặc Cua.
6. Câu cuối: Cua kêu gọi theo dõi Crab vibe (hình "bell" hoặc crab-closeup).
- Câu của khách không cần hình riêng: để beats rỗng ([{}]) hoặc 1 beat không layout -> engine tự dựng cảnh 2 nhân vật đối thoại. Chỉ thêm hình (object-hero / versus / count) khi cần minh hoạ thứ KHÁC (con số, so sánh, bộ phận...).

KIẾN THỨC
- MỌI thông tin phải lấy từ NGUỒN bên dưới. Không thêm con số, tên riêng, chi tiết nào không có trong nguồn. Phần "diễn" (tính cách, cảm xúc, câu đùa) được sáng tạo, nhưng không được đổi sự thật.
- Nếu chủ đề người dùng đưa có chi tiết sai so với nguồn, viết theo nguồn.
- Nếu NGUỒN không có thông tin trả lời đúng chủ đề: đặt "covered": false (vẫn điền các trường khác tối thiểu). KHÔNG lái sang chủ đề khác.
- Đơn vị đo đổi sang đơn vị người Việt quen dùng (pound → kg, gallon → lít, feet/inch → mét/cm, °F → °C, đô la → giữ "đô"), làm tròn dễ nghe (vd "khoảng 30 ký"); ghi phép đổi vào "facts".
- Gọi đúng TÊN đối tượng ít nhất 1 lần (tên tiếng Việt phổ biến; không có thì tên gốc), nói nó Ở ĐÂU và 1 con số nhận dạng nếu nguồn có.
- Điền "subject": tên gọi, tên khoa học (nếu là sinh vật và nguồn có), nơi sống/xuất hiện — lấy từ nguồn. Tên khoa học KHÔNG đọc trong lời thoại (giọng đọc tiếng Việt đọc tiếng Latin rất khó nghe), nó được ghi trong mô tả video.
- Liệt kê từng thông tin dùng trong kịch bản vào "facts", kèm câu trích NGUYÊN VĂN từ nguồn làm bằng chứng.`,
		accuracy: `Đổi đơn vị (pound → kg, feet → mét...) và làm tròn hợp lý là ĐÚNG, không phải bịa. Lời thoại "diễn" của nhân vật (tính cách, cảm xúc, câu đùa) không cần có trong nguồn, miễn không đổi sự thật.
Mỗi thông tin trong kịch bản phải có trong NGUỒN. Con số, tên, quan hệ nhân quả sai hoặc không có trong nguồn = bịa (điểm ≤ 2).
Kiểm tra "facts": câu trích phải thật sự có trong nguồn và đúng nghĩa với thông tin.`,
		essentials: `Xem xong người xem phải trả lời được: nó TÊN là gì (gọi đúng tên ít nhất 1 lần trong lời thoại, không chỉ "loài này"), nó Ở ĐÂU / sống ở đâu (nếu nguồn có).
Thiếu tên → ≤ 2. Có tên nhưng thiếu nơi sống/xuất hiện mà nguồn có ghi → 3. Có thêm 1 con số nhận dạng (kích thước, cân nặng...) → 5.`,
	},
	zodiac: {
		id: 'zodiac',
		needsSource: false,
		story: false,
		writer: `Định dạng ZODIAC: cung hoàng đạo & tâm lý vui, giọng hài hước, dễ đồng cảm ("đúng quá trời luôn!").
- Đây là nội dung GIẢI TRÍ: dùng cách nói như "người ta hay nói", "dân Cự Giải thường...", không khẳng định như khoa học.
- Không tiên tri về sức khoẻ, tiền bạc, tình duyên cụ thể; không chê bai nặng nề cung nào.
- Chú cua là Cự Giải, có thể tự nhận "Cua cũng là Cự Giải nè".
- CẤU TRÚC: 5–8 câu, tổng 90–115 chữ (≈ 30–40 giây), mỗi câu ≤ 22 chữ. Câu 1 = hook; giữa = các điểm "đúng quá trời"; câu áp chót = điểm hài nhất; câu cuối = kêu gọi theo dõi.
- Không dùng "guest"; mọi câu "speaker": "crab".
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
