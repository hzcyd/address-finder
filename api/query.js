// 这是在后端（服务器）运行的代码
// 它采用两步查询法，以获得更精确的街道级地址

module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        response.setHeader('Allow', ['POST']);
        return response.status(405).json({ message: `方法 ${request.method} 不被允许` });
    }

    const { address } = request.body;
    if (!address) {
        return response.status(400).json({ message: '缺少地址参数' });
    }

    const apiKey = process.env.GAODE_API_KEY;
    if (!apiKey) {
        console.error("[SERVER_ERROR] 服务端错误：未在环境变量中配置GAODE_API_KEY");
        return response.status(500).json({ message: '服务器配置错误' });
    }
    
    try {
        // --- 步骤 1: 关键字搜索，获取经纬度 ---
        const textSearchUrl = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(address)}&offset=1&page=1`;
        const textSearchResponse = await fetch(textSearchUrl);
        const textSearchData = await textSearchResponse.json();

        if (textSearchData.status !== '1' || !textSearchData.pois || textSearchData.pois.length === 0) {
            return response.status(200).json({ completedAddress: "未能查询到该地址，请尝试更正或细化地址。" });
        }

        const poi = textSearchData.pois[0];
        const location = poi.location; // 获取经纬度，例如 "116.405285,39.904989"

        if (!location) {
             // 如果第一步就没有坐标，直接返回一个拼接的结果
            const simpleAddress = `${poi.pname || ''}${poi.cityname || ''}${poi.adname || ''} ${poi.address || ''}`;
            return response.status(200).json({ completedAddress: simpleAddress.trim() });
        }

        // --- 步骤 2: 逆地理编码，获取包含街道的结构化地址 ---
        const regeoUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${location}`;
        const regeoResponse = await fetch(regeoUrl);
        const regeoData = await regeoResponse.json();

        if (regeoData.status !== '1' || !regeoData.regeocode) {
            throw new Error('逆地理编码失败');
        }

        const regeocode = regeoData.regeocode;
        const addressComponent = regeocode.addressComponent;
        
        const province = addressComponent.province || '';
        const city = Array.isArray(addressComponent.city) ? (province) : (addressComponent.city || ''); // 处理直辖市city返回空数组的情况
        const district = addressComponent.district || '';
        const township = addressComponent.township || ''; // 街道信息

        // --- 步骤 3: 智能拼接最终地址 ---
        // 我们的目标是：补全官方的省市区和街道，同时保留用户输入的具体门牌号等信息
        
        // 从用户原始输入中提取出"市"之后的部分，作为详细地址
        let userInputDetail = address;
        const cityInUserInput = city.replace('市', '');
        const cityIndex = address.indexOf(cityInUserInput);
        if (cityIndex > -1) {
            userInputDetail = address.substring(cityIndex + cityInUserInput.length);
        }
        
        // 组合成最终地址
        const finalAddress = `${province}${city}${district}${township} ${userInputDetail}`;

        return response.status(200).json({ completedAddress: finalAddress.trim() });

    } catch (error) {
        console.error("[API_CATCH_ERROR] 调用高德API时捕获到异常:", error);
        return response.status(500).json({ message: '服务器内部错误，无法连接地图服务。' });
    }
};

