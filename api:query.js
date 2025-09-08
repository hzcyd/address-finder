// 这是在后端（服务器）运行的代码
// 它会接收前端的请求，然后用安全的Key去调用高德API

// 使用 module.exports 导出函数，以获得更好的兼容性
module.exports = async (request, response) => {
    // 1. 只接受 POST 请求
    if (request.method !== 'POST') {
        response.setHeader('Allow', ['POST']);
        return response.status(405).json({ message: `方法 ${request.method} 不被允许` });
    }

    // 2. 从请求体中获取地址
    const { address } = request.body;
    if (!address) {
        return response.status(400).json({ message: '缺少地址参数' });
    }

    // --- 新增日志 ---
    console.log(`[API_LOG] 收到查询请求, 地址: "${address}"`);

    // 3. 从服务器的环境变量中安全地获取 API Key
    const apiKey = process.env.GAODE_API_KEY;
    if (!apiKey) {
        console.error("[SERVER_ERROR] 服务端错误：未在环境变量中配置GAODE_API_KEY");
        return response.status(500).json({ message: '服务器配置错误' });
    }
    
    // 4. 构建请求高德API的URL
    const gaodeUrl = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(address)}&offset=1&page=1`;

    try {
        // 5. 从后端服务器发起对高德的请求
        const apiResponse = await fetch(gaodeUrl);
        const data = await apiResponse.json();

        // 6. --- 增强的错误处理 ---
        // 检查高德返回的状态码，'0'代表请求失败
        if (data.status === '0') {
            console.error(`[GAODE_API_ERROR] 高德API返回错误: ${data.info} (错误码: ${data.infocode})`);
            
            // 根据常见的错误码，返回更友好的提示给前端
            let userMessage = `地图服务返回错误: ${data.info}`;
            if (data.infocode === "10001") { // 10001 是 key 无效的错误码
                userMessage = "地图服务API Key配置无效，请检查您在后台设置的Key是否正确。";
            }
            return response.status(400).json({ message: userMessage });
        }
        
        // 7. 处理高德返回的成功数据
        if (data.status === '1' && data.pois && data.pois.length > 0) {
            const poi = data.pois[0]; // 取最匹配的结果
            const province = poi.pname || ''; // 省
            const city = poi.cityname || ''; // 市
            const district = poi.adname || '';   // 区
            const detailAddress = poi.address || ''; // 详细地址（通常是街道和门牌号）

            const completedAddress = `${province}${city}${district} ${detailAddress}`;

            // 8. 将处理好的结果返回给前端
            return response.status(200).json({ completedAddress: completedAddress.trim() });

        } else {
            // 如果高德未返回有效结果
            return response.status(200).json({ completedAddress: "未能查询到该地址的区划信息，请尝试更正地址。" });
        }

    } catch (error) {
        console.error("[SERVER_CATCH_ERROR] 调用高德API时捕获到异常:", error);
        return response.status(500).json({ message: '服务器内部错误，无法连接地图服务。' });
    }
};

