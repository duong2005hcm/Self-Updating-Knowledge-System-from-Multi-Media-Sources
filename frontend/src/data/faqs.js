export const faqs = [
  {
    category: "Tổng quan",
    question: "Hệ thống tri thức Hỗ trợ tra cứu Sức khỏe là gì?",
    answer:
      "Hệ thống tri thức Hỗ trợ tra cứu Sức khỏe là nền tảng giúp người dùng tìm kiếm tài liệu bệnh học, đọc tin tức y tế, xem nguồn tham khảo và hỏi AI dựa trên kho dữ liệu đã được thu thập, xử lý và quản trị. Thay vì chỉ là một chatbot trả lời tự do, hệ thống tập trung vào việc tổ chức tri thức từ nhiều nguồn như PDF, web, bài viết y tế và nội dung cộng đồng đã được kiểm duyệt. Người dùng có thể tra cứu theo tên bệnh, triệu chứng hoặc chủ đề sức khỏe, sau đó xem tài liệu liên quan, tóm tắt đã được duyệt và nguồn gốc của thông tin.",
  },
  {
    category: "Tổng quan",
    question: "Hệ thống có thay thế bác sĩ không?",
    answer:
      "Không. Hệ thống chỉ có vai trò hỗ trợ tra cứu và tham khảo thông tin sức khỏe. Các nội dung trong hệ thống không thay thế tư vấn, chẩn đoán hoặc điều trị từ bác sĩ hay chuyên gia y tế. Người dùng không nên tự kết luận bệnh hoặc tự điều trị chỉ dựa trên thông tin tìm được trong hệ thống. Nếu bạn có triệu chứng nghiêm trọng, kéo dài, bất thường hoặc đang lo lắng về tình trạng sức khỏe, bạn nên đến cơ sở y tế hoặc bệnh viện để được thăm khám trực tiếp.",
  },
  {
    category: "Tổng quan",
    question: "Hệ thống dành cho những ai?",
    answer:
      "Hệ thống phù hợp với người dùng muốn tìm hiểu thông tin sức khỏe có nguồn tham khảo, sinh viên hoặc người học cần tài liệu bệnh học, người quan tâm đến tin tức y tế và quản trị viên cần quản lý kho tri thức. Với người dùng phổ thông, hệ thống giúp tra cứu nhanh các tài liệu liên quan đến bệnh hoặc triệu chứng. Với admin, hệ thống hỗ trợ quản lý nguồn dữ liệu, kiểm duyệt tài liệu, theo dõi pipeline ingest và xử lý phản hồi từ người dùng.",
  },
  {
    category: "Tài khoản",
    question: "Tôi có cần đăng nhập để sử dụng hệ thống không?",
    answer:
      "Một số nội dung công khai như trang chủ, blog, FAQ, giới thiệu hoặc kết quả tìm kiếm cơ bản có thể được xem mà không cần đăng nhập. Tuy nhiên, các chức năng cá nhân hóa như hỏi Ask AI, viết bài blog, đánh giá bài viết, gửi phản hồi, đánh giá hệ thống hoặc chỉnh sửa thông tin cá nhân thường yêu cầu người dùng đăng nhập. Việc đăng nhập giúp hệ thống lưu phản hồi theo đúng người dùng thật và hỗ trợ quản trị chất lượng nội dung tốt hơn.",
  },
  {
    category: "Tài khoản",
    question: "Tôi có thể chỉnh sửa thông tin cá nhân không?",
    answer:
      "Có. Sau khi đăng nhập, người dùng có thể mở menu tài khoản trên thanh điều hướng và vào mục thông tin cá nhân để cập nhật các thông tin cơ bản như họ tên, ngày sinh hoặc số điện thoại nếu hệ thống đã bật chức năng này. Email thường được lấy từ tài khoản đăng nhập và có thể được đặt ở trạng thái chỉ đọc để tránh sai lệch dữ liệu xác thực. Thông tin cá nhân chỉ dùng để quản lý tài khoản và không nên nhập các dữ liệu nhạy cảm không cần thiết.",
  },
  {
    category: "Tài khoản",
    question: "Tôi có thể đổi mật khẩu không?",
    answer:
      "Có. Nếu bạn đăng nhập bằng email và mật khẩu, bạn có thể vào mục đổi mật khẩu trong menu tài khoản. Khi đổi mật khẩu, hệ thống có thể yêu cầu nhập lại mật khẩu hiện tại để xác thực lại người dùng trước khi cho phép cập nhật mật khẩu mới. Mật khẩu không được lưu trong Firestore hoặc cơ sở dữ liệu nội dung của hệ thống, mà được xử lý thông qua Firebase Authentication để đảm bảo an toàn hơn.",
  },
  {
    category: "Dữ liệu",
    question: "Dữ liệu trong hệ thống được lấy từ đâu?",
    answer:
      "Kho tri thức có thể được tổng hợp từ nhiều nguồn như tài liệu PDF bệnh học, hướng dẫn y tế, bài viết học thuật, tin tức y tế, trang web sức khỏe và bài viết cộng đồng được kiểm duyệt. Các nguồn này được đưa vào hệ thống thông qua quy trình ingest, sau đó được chuẩn hóa metadata, tạo phiên bản, tạo embedding để tìm kiếm và có thể được admin kiểm duyệt trước khi hiển thị công khai. Mục tiêu là giúp người dùng không chỉ nhận câu trả lời mà còn biết thông tin đến từ nguồn nào.",
  },
  {
    category: "Dữ liệu",
    question: "Tại sao hệ thống cần admin kiểm duyệt dữ liệu?",
    answer:
      "Thông tin sức khỏe có ảnh hưởng trực tiếp đến nhận thức và quyết định của người dùng, nên dữ liệu cần được kiểm soát cẩn thận. Admin có nhiệm vụ xem xét tài liệu mới, kiểm tra tóm tắt AI, duyệt hoặc từ chối bài viết cộng đồng, xử lý feedback và đảm bảo nội dung không sai lệch hoặc gây hiểu nhầm. Quy trình kiểm duyệt giúp hệ thống an toàn hơn so với việc cho AI tự động trả lời hoặc tự động công khai mọi dữ liệu vừa thu thập được.",
  },
  {
    category: "Dữ liệu",
    question: "AI Summary là gì?",
    answer:
      "AI Summary là phần tóm tắt nội dung tài liệu được AI hỗ trợ tạo ra sau khi tài liệu được ingest vào hệ thống. Tuy nhiên, bản tóm tắt này không nên được hiển thị trực tiếp cho người dùng nếu chưa kiểm tra. Admin có thể xem, chỉnh sửa và duyệt AI Summary trước khi lưu vào Firestore. Khi người dùng mở trang chi tiết tài liệu, hệ thống sẽ hiển thị bản tóm tắt đã được duyệt thay vì gọi AI lại, giúp trang tải nhanh hơn và giảm nguy cơ nội dung chưa kiểm soát.",
  },
  {
    category: "Tìm kiếm",
    question: "Tôi có thể tìm kiếm những gì?",
    answer:
      "Bạn có thể tìm kiếm theo tên bệnh, triệu chứng, chủ đề sức khỏe hoặc từ khóa liên quan. Ví dụ, bạn có thể nhập “cúm”, “tiểu đường”, “sốt xuất huyết”, “tim mạch”, “chậm nói” hoặc “bệnh hô hấp”. Hệ thống sẽ cố gắng tìm các tài liệu, tin tức, bài viết hoặc nguồn tham khảo liên quan. Nếu không có dữ liệu phù hợp trong kho tri thức, hệ thống nên hiển thị thông báo chưa tìm thấy kết quả thay vì cố trả về tài liệu không liên quan.",
  },
  {
    category: "Tìm kiếm",
    question: "Tìm kiếm ngữ nghĩa là gì?",
    answer:
      "Tìm kiếm ngữ nghĩa là cách tìm kiếm dựa trên ý nghĩa của truy vấn thay vì chỉ so khớp chính xác từng từ khóa. Ví dụ, khi người dùng tìm “tiểu đường”, hệ thống có thể hiểu rằng “đái tháo đường” cũng là một khái niệm liên quan. Cách tìm kiếm này hữu ích khi người dùng không biết chính xác thuật ngữ chuyên môn. Tuy nhiên, vì đây là lĩnh vực sức khỏe, hệ thống vẫn cần bộ lọc liên quan để tránh trả về tài liệu sai chủ đề.",
  },
  {
    category: "Tìm kiếm",
    question: "Hybrid search là gì?",
    answer:
      "Hybrid search là chế độ kết hợp giữa tìm kiếm từ khóa và tìm kiếm ngữ nghĩa. Tìm kiếm từ khóa giúp ưu tiên các tài liệu có chứa cụm từ người dùng nhập, còn tìm kiếm ngữ nghĩa giúp tìm các nội dung có ý nghĩa gần với truy vấn. Khi kết hợp hai cách này, hệ thống có thể tìm được kết quả linh hoạt hơn nhưng vẫn cần ngưỡng lọc để tránh trả về tài liệu không liên quan. Đây là chế độ phù hợp cho tra cứu sức khỏe nếu được cấu hình chặt chẽ.",
  },
  {
    category: "Tìm kiếm",
    question: "Vì sao đôi khi tìm kiếm không ra kết quả?",
    answer:
      "Có nhiều lý do khiến hệ thống không tìm thấy kết quả. Có thể kho tri thức chưa có tài liệu liên quan đến chủ đề bạn tìm, từ khóa quá cụ thể, chính tả chưa đúng hoặc tài liệu liên quan chưa được admin duyệt công khai. Khi không có kết quả phù hợp, hệ thống nên hiển thị trạng thái rỗng để người dùng thử từ khóa khác, thay vì trả về tài liệu sai chủ đề. Bạn có thể thử nhập từ khóa rộng hơn hoặc dùng tên bệnh phổ biến hơn.",
  },
  {
    category: "Tìm kiếm",
    question: "Tại sao kết quả tìm kiếm có thể không hoàn toàn chính xác?",
    answer:
      "Tìm kiếm trong hệ thống dựa trên dữ liệu đã được ingest, embedding, metadata và các thuật toán xếp hạng liên quan. Nếu dữ liệu gốc bị nhiễu, tài liệu có nội dung quá rộng hoặc truy vấn của người dùng chưa rõ ràng, kết quả có thể chưa thật sự chính xác. Vì vậy, người dùng nên đọc tiêu đề, tóm tắt, nguồn gốc và ngày cập nhật trước khi sử dụng thông tin. Với nội dung sức khỏe, không nên chỉ dựa vào một kết quả duy nhất.",
  },
  {
    category: "Tìm kiếm",
    question: "Search đa nguồn gồm những gì?",
    answer:
      "Search đa nguồn có thể bao gồm nhiều tầng kết quả như tài liệu bệnh học hoặc PDF, tin tức y tế liên quan, bài viết cộng đồng hoặc blog, và liên kết tham khảo bên ngoài nếu hệ thống được tích hợp Serper.dev hoặc công cụ tìm kiếm khác. Mục tiêu là giúp người dùng không chỉ xem một file PDF mà còn có thêm bối cảnh từ tin tức, bài viết và nguồn tham khảo khác. Tuy nhiên, hệ thống chỉ nên hiển thị các nguồn thật sự liên quan đến truy vấn.",
  },
  {
    category: "Tài liệu",
    question: "Tôi có thể xem nguồn tài liệu không?",
    answer:
      "Có. Mỗi kết quả tìm kiếm hoặc trang chi tiết tài liệu nên hiển thị các thông tin như tiêu đề, loại nguồn, chủ đề, trạng thái, ngày cập nhật và nút xem hoặc tải tài liệu gốc nếu có. Việc hiển thị nguồn giúp người dùng tự đối chiếu thông tin và đánh giá độ tin cậy. Với các liên kết ngoài, người dùng nên kiểm tra thêm nguồn phát hành, đơn vị chịu trách nhiệm và thời gian cập nhật.",
  },
  {
    category: "Tài liệu",
    question: "Vì sao trang chi tiết tài liệu chỉ hiển thị tóm tắt đã duyệt?",
    answer:
      "Trang chi tiết tài liệu ưu tiên hiển thị tóm tắt AI đã được admin kiểm duyệt để giúp người dùng đọc nhanh nội dung chính và giảm thời gian tải trang. Trước đây, nếu hệ thống phải tải nhiều đoạn trích hoặc gọi AI mỗi lần mở tài liệu, trải nghiệm sẽ chậm hơn và khó kiểm soát nội dung. Khi summary đã được lưu sẵn, người dùng có thể xem nhanh nội dung đã qua kiểm tra, còn tài liệu gốc vẫn có thể được mở hoặc tải về nếu cần đọc đầy đủ.",
  },
  {
    category: "Tài liệu",
    question: "Tôi có thể tải PDF gốc không?",
    answer:
      "Có, nếu tài liệu có file gốc hoặc URL file được lưu trong hệ thống, trang chi tiết có thể hiển thị nút xem PDF hoặc tải PDF. Người dùng nên đọc tài liệu gốc khi cần kiểm tra đầy đủ nội dung, đặc biệt với các tài liệu chuyên môn hoặc hướng dẫn y tế. Tóm tắt AI chỉ giúp nắm ý chính nhanh hơn, không thay thế việc đọc nguồn gốc khi cần độ chính xác cao.",
  },
  {
    category: "Ask AI",
    question: "Ask AI hoạt động như thế nào?",
    answer:
      "Ask AI hoạt động bằng cách nhận câu hỏi của người dùng, truy xuất các đoạn tài liệu liên quan trong kho tri thức như PDF hoặc dữ liệu web/PDF từ ChromaDB, sau đó tạo câu trả lời dựa trên các ngữ cảnh đã tìm được. AI không nên tự trả lời ngoài dữ liệu được cung cấp. Nếu kho tri thức chưa có đủ thông tin phù hợp, Ask AI cần nói rõ rằng chưa tìm thấy dữ liệu đủ liên quan thay vì suy đoán.",
  },
  {
    category: "Ask AI",
    question: "Ask AI có được tự bịa câu trả lời không?",
    answer:
      "Không. Vì đây là hệ thống hỗ trợ tra cứu sức khỏe, Ask AI phải tuân thủ nguyên tắc không bịa thông tin, không tự chẩn đoán bệnh, không kê đơn và không đưa ra phác đồ điều trị cá nhân hóa. Câu trả lời cần dựa trên nguồn đã truy xuất được từ kho tri thức. Nếu không có nguồn phù hợp, câu trả lời an toàn nhất là thông báo chưa có đủ dữ liệu và khuyến nghị người dùng tham khảo cơ sở y tế khi có dấu hiệu nghiêm trọng.",
  },
  {
    category: "Ask AI",
    question: "Tôi nên hỏi Ask AI như thế nào?",
    answer:
      "Bạn nên đặt câu hỏi rõ ràng, có ngữ cảnh và tránh hỏi quá chung chung. Ví dụ, thay vì hỏi “bệnh này sao?”, bạn có thể hỏi “Tóm tắt tài liệu liên quan đến cúm mùa”, “Các điểm cần chú ý khi đọc tài liệu về tiểu đường” hoặc “Nguồn nào nói về biến chứng của bệnh hô hấp?”. Câu hỏi càng rõ thì hệ thống càng dễ truy xuất đúng tài liệu liên quan.",
  },
  {
    category: "Ask AI",
    question: "Ask AI có thể chẩn đoán bệnh cho tôi không?",
    answer:
      "Không. Ask AI không có khả năng khám trực tiếp, không biết đầy đủ tiền sử bệnh, kết quả xét nghiệm, tình trạng cơ thể và các yếu tố cá nhân của bạn. Vì vậy, Ask AI không được dùng để chẩn đoán bệnh hoặc quyết định điều trị. Nếu bạn có triệu chứng nặng, kéo dài, bất thường, sốt cao, khó thở, đau dữ dội hoặc lo lắng về sức khỏe, bạn nên đến cơ sở y tế để được thăm khám.",
  },
  {
    category: "Ask AI",
    question: "Tôi có thể đánh giá câu trả lời của Ask AI không?",
    answer:
      "Có. Sau mỗi câu trả lời, hệ thống có thể cho phép bạn đánh giá câu trả lời là hữu ích hoặc chưa hữu ích, kèm góp ý nếu muốn. Phản hồi này được lưu để admin xem xét chất lượng câu trả lời, phát hiện trường hợp AI trả lời chưa đúng trọng tâm hoặc nguồn truy xuất chưa phù hợp. Đây là một phần quan trọng trong quy trình cải thiện chất lượng hệ thống.",
  },
  {
    category: "Blog",
    question: "Blog dùng để làm gì?",
    answer:
      "Blog là nơi hiển thị các bài viết sức khỏe, tin tức y tế hoặc nội dung cộng đồng đã được đăng trong hệ thống. Người dùng có thể đọc các bài viết tham khảo, xem nguồn nếu có và đánh giá chất lượng bài viết. Blog giúp hệ thống không chỉ có tài liệu PDF mà còn có nội dung dễ đọc hơn, phù hợp với người dùng phổ thông.",
  },
  {
    category: "Blog",
    question: "Người dùng có thể viết bài không?",
    answer:
      "Có. Người dùng đã đăng nhập có thể tạo bài viết sức khỏe hoặc chia sẻ nội dung tham khảo nếu hệ thống bật chức năng này. Khi tạo bài, người dùng có thể nhập tiêu đề, mô tả ngắn, nội dung, chủ đề, tag và ảnh đại diện bằng URL. Vì liên quan đến sức khỏe, bài viết có thể được lưu ở trạng thái chờ duyệt để admin kiểm tra trước khi hiển thị công khai.",
  },
  {
    category: "Blog",
    question: "Vì sao bài viết của tôi chưa hiển thị công khai?",
    answer:
      "Bài viết của bạn có thể đang ở trạng thái chờ duyệt. Điều này giúp admin kiểm tra nội dung, tránh thông tin sai lệch, nội dung không phù hợp hoặc thông tin có thể gây hiểu nhầm về sức khỏe. Sau khi admin duyệt, bài viết mới được hiển thị công khai trên Blog hoặc trong kết quả tìm kiếm liên quan.",
  },
  {
    category: "Blog",
    question: "Tôi có thể đánh giá hoặc bình luận bài viết không?",
    answer:
      "Có. Người dùng đã đăng nhập có thể đánh giá bài viết bằng số sao và gửi phản hồi ngắn. Mỗi người dùng thường chỉ có một đánh giá cho một bài viết, nếu gửi lại thì hệ thống cập nhật đánh giá cũ thay vì tạo nhiều bản ghi trùng lặp. Các phản hồi này giúp admin biết bài viết nào hữu ích, bài nào cần chỉnh sửa hoặc kiểm tra lại.",
  },
  {
    category: "Phản hồi",
    question: "Tôi có thể đánh giá toàn bộ hệ thống không?",
    answer:
      "Có. Trang About có thể có phần đánh giá hệ thống để người dùng chấm sao và viết cảm nhận khi sử dụng sản phẩm. Phản hồi này được lưu vào collection riêng, ví dụ system_feedbacks, để trang Home có thể hiển thị các cảm nhận nổi bật. Đây là cách giúp nhóm phát triển hiểu người dùng đang hài lòng hoặc gặp khó khăn ở điểm nào.",
  },
  {
    category: "Phản hồi",
    question: "Feedback của tôi được dùng để làm gì?",
    answer:
      "Feedback của bạn giúp admin và nhóm phát triển cải thiện chất lượng hệ thống. Ví dụ, feedback bài viết giúp kiểm tra nội dung nào hữu ích, feedback Ask AI giúp phát hiện câu trả lời chưa phù hợp, còn feedback hệ thống giúp đánh giá trải nghiệm tổng thể. Các phản hồi này không nên được dùng cho mục đích chẩn đoán hay tư vấn y tế cá nhân.",
  },
  {
    category: "An toàn y tế",
    question: "Khi nào tôi nên đi khám thay vì chỉ tra cứu trên hệ thống?",
    answer:
      "Bạn nên đi khám nếu có triệu chứng nặng, kéo dài, bất thường hoặc ảnh hưởng rõ đến sinh hoạt. Một số dấu hiệu cần chú ý gồm khó thở, đau ngực, sốt cao không giảm, mất ý thức, co giật, đau dữ dội, nôn ói kéo dài, mất nước, chảy máu bất thường hoặc triệu chứng ở trẻ nhỏ/người cao tuổi/phụ nữ mang thai. Hệ thống chỉ giúp bạn tham khảo thông tin, không thay thế việc khám trực tiếp.",
  },
  {
    category: "An toàn y tế",
    question: "Hệ thống có đưa ra phác đồ điều trị không?",
    answer:
      "Không. Hệ thống không đưa ra phác đồ điều trị cá nhân hóa, không kê đơn thuốc và không chỉ định liều lượng sử dụng thuốc cho từng người. Các thông tin nếu có về điều trị chỉ được trình bày dưới dạng tham khảo từ tài liệu và cần được hiểu trong bối cảnh nguồn gốc. Mọi quyết định điều trị cần có sự tư vấn của bác sĩ hoặc chuyên gia y tế.",
  },
  {
    category: "An toàn y tế",
    question: "Tôi phát hiện thông tin sai thì phải làm gì?",
    answer:
      "Nếu bạn thấy nội dung không chính xác, khó hiểu, thiếu nguồn hoặc có khả năng gây hiểu nhầm, bạn nên gửi phản hồi ngay trên bài viết, tài liệu hoặc câu trả lời Ask AI nếu hệ thống có hỗ trợ. Admin có thể xem phản hồi, kiểm tra lại nguồn, chỉnh sửa tóm tắt, ẩn nội dung hoặc cập nhật tài liệu mới hơn. Đây là một phần của quy trình quản trị chất lượng tri thức.",
  },
  {
    category: "Quản trị",
    question: "Hệ thống cập nhật dữ liệu như thế nào?",
    answer:
      "Dữ liệu được đưa vào hệ thống qua các quy trình ingest như ingest PDF, ingest web hoặc ingest bài viết. Sau khi nhận dữ liệu, backend có thể trích xuất nội dung, tính checksum để phát hiện trùng lặp hoặc thay đổi, tạo phiên bản tài liệu, chia chunk, tạo embedding và lưu metadata. Admin có thể xem kết quả created, updated hoặc skipped, kiểm tra AI Summary và duyệt nội dung trước khi công khai.",
  },
  {
    category: "Quản trị",
    question: "Created, Updated và Skipped khi ingest có nghĩa là gì?",
    answer:
      "Created nghĩa là hệ thống phát hiện tài liệu mới và đã thêm vào kho tri thức. Updated nghĩa là tài liệu đã tồn tại nhưng nội dung thay đổi, nên hệ thống tạo phiên bản mới. Skipped nghĩa là tài liệu đã có và không phát hiện thay đổi đáng kể, vì vậy hệ thống không cần xử lý lại để tránh tốn thời gian và tài nguyên. Các trạng thái này giúp admin theo dõi hiệu quả pipeline cập nhật tri thức.",
  },
  {
    category: "Quản trị",
    question: "Vì sao cần quản lý phiên bản tài liệu?",
    answer:
      "Quản lý phiên bản giúp hệ thống biết tài liệu đã thay đổi khi nào, nội dung mới có khác bản cũ không và phiên bản nào đang được sử dụng công khai. Điều này rất quan trọng với dữ liệu sức khỏe vì thông tin có thể được cập nhật theo thời gian. Khi có phiên bản mới, admin có thể kiểm tra lại tóm tắt, nguồn và trạng thái trước khi đưa vào sử dụng.",
  },
  {
    category: "Quản trị",
    question: "Admin dùng feedback của người dùng như thế nào?",
    answer:
      "Admin có thể xem feedback bài viết, feedback Ask AI và feedback hệ thống để phát hiện nội dung chưa phù hợp, câu trả lời chưa hữu ích hoặc trải nghiệm người dùng chưa tốt. Những phản hồi này có thể được đánh dấu đã xử lý, ẩn nếu không phù hợp hoặc dùng làm cơ sở để cập nhật tài liệu, chỉnh sửa summary và cải thiện quy trình tìm kiếm.",
  },
];