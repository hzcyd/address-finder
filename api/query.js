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

    // 3. 从服务器的环境变量中安全地获取 API Key
    const apiKey = process.env.GAODE_API_KEY;
    if (!apiKey) {
        console.error("服务端错误：未配置GAODE_API_KEY环境变量");
        return response.status(500).json({ message: '服务器配置错误' });
    }
    
    // 4. 构建请求高德API的URL - 使用地理编码API，更适合地址查询
    const gaodeUrl = `https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodeURIComponent(address)}`;

    try {
        // 5. 从后端服务器发起对高德的请求
        const apiResponse = await fetch(gaodeUrl);
        const data = await apiResponse.json();

        console.log('高德API响应:', JSON.stringify(data, null, 2)); // 添加调试日志

        // 6. 处理高德返回的数据
        if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
            const geocode = data.geocodes[0]; // 取最匹配的结果
            const province = geocode.province || ''; // 省
            const city = geocode.city || ''; // 市
            const district = geocode.district || '';   // 区
            const formattedAddress = geocode.formatted_address || ''; // 格式化地址

            // 如果地理编码API返回了完整地址，直接使用
            if (formattedAddress) {
                return response.status(200).json({ completedAddress: formattedAddress });
            }

            // 否则组合行政区划信息
            const completedAddress = `${province}${city}${district}`;
            return response.status(200).json({ completedAddress: completedAddress.trim() });

        } else {
            // 如果地理编码API没有结果，尝试使用POI搜索API作为备选
            console.log('地理编码API无结果，尝试POI搜索API');
            const poiUrl = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(address)}&offset=1&page=1`;
            const poiResponse = await fetch(poiUrl);
            const poiData = await poiResponse.json();

            console.log('POI API响应:', JSON.stringify(poiData, null, 2)); // 添加调试日志

            if (poiData.status === '1' && poiData.pois && poiData.pois.length > 0) {
                const poi = poiData.pois[0];
                const province = poi.pname || '';
                const city = poi.cityname || '';
                const district = poi.adname || '';
                const detailAddress = poi.address || '';

                const completedAddress = `${province}${city}${district} ${detailAddress}`;
                return response.status(200).json({ completedAddress: completedAddress.trim() });
            }

            // 如果两个API都没有结果
            return response.status(200).json({ 
                completedAddress: "未能查询到该地址的区划信息，请尝试更正地址或使用更通用的地址描述。" 
            });
        }

    } catch (error) {
        console.error("调用高德API时出错:", error);
        return response.status(500).json({ message: '调用地图服务时出错' });
    }
};
