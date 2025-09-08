// 这是在后端（服务器）运行的代码
// 它会接收前端的请求，然后用安全的Key去调用高德API

export default async function handler(request, response) {
    // 1. 只接受 POST 请求
    if (request.method !== 'POST') {
        return response.status(405).json({ message: '仅支持POST方法' });
    }

    // 2. 从请求体中获取地址
    const { address } = request.body;
    if (!address) {
        return response.status(400).json({ message: '缺少地址参数' });
    }

    // 3. 从服务器的环境变量中安全地获取 API Key
    const apiKey = process.env.GAODE_API_KEY;
    if (!apiKey) {
        console.error("服务端错误：未配置GAODE_API_KEY环境变量");
        return response.status(500).json({ message: '服务器配置错误' });
    }
    
    // 4. 构建请求高德API的URL
    const gaodeUrl = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(address)}&offset=1&page=1`;

    try {
        // 5. 从后端服务器发起对高德的请求
        const apiResponse = await fetch(gaodeUrl);
        const data = await apiResponse.json();

        // 6. 处理高德返回的数据
        if (data.status === '1' && data.pois && data.pois.length > 0) {
            const poi = data.pois[0]; // 取最匹配的结果
            const province = poi.pname; // 省
            const city = poi.cityname; // 市
            const district = poi.adname;   // 区
            const detailAddress = poi.address; // 详细地址（通常是街道和门牌号）

            const completedAddress = `${province}${city}${district} ${detailAddress}`;

            // 7. 将处理好的结果返回给前端
            return response.status(200).json({ completedAddress });

        } else {
            // 如果高德未返回有效结果
            return response.status(200).json({ completedAddress: "未能查询到该地址的区划信息，请尝试更正地址。" });
        }

    } catch (error) {
        console.error("调用高德API时出错:", error);
        return response.status(500).json({ message: '调用地图服务时出错' });
    }
}
