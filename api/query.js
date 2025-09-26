// Vercel Serverless Function
// 在 Node.js 18+ 环境中, fetch 是全局可用的, 无需引入

// 使用 module.exports 以确保与 Vercel 的 Node.js 环境最大兼容
module.exports = async (req, res) => {
    // --- CORS 跨域配置 ---
    // 允许来自任何源的请求，方便本地开发和线上部署
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 浏览器在发送正式请求前会发送一个 OPTIONS "预检"请求，我们直接返回成功
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // --- 主逻辑 ---
    const { address } = req.query;
    const apiKey = process.env.GAODE_API_KEY;

    if (!apiKey) {
        console.error("Server Error: GAODE_API_KEY is not configured in Vercel environment variables.");
        return res.status(500).json({ error: '服务器错误：API Key未配置' });
    }

    if (!address || address.trim() === '') {
        return res.status(400).json({ error: '查询错误：地址不能为空' });
    }

    try {
        // --- 步骤 1: 关键字搜索，获取经纬度 ---
        const textSearchUrl = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(address)}&offset=1&page=1`;
        const textRes = await fetch(textSearchUrl);
        const textData = await textRes.json();

        if (textData.status !== '1' || !textData.pois || textData.pois.length === 0) {
            return res.status(200).json({ result: "查询失败：未找到匹配的POI" });
        }

        const poi = textData.pois[0];
        const location = poi.location;

        if (!location) {
            const fallbackResult = `${poi.pname || ''}${poi.cityname || ''}${poi.adname || ''} ${poi.address || ''}`.trim();
            return res.status(200).json({ result: fallbackResult });
        }

        // --- 步骤 2: 逆地理编码，获取结构化地址 ---
        const regeoUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${location}`;
        const regeoRes = await fetch(regeoUrl);
        const regeoData = await regeoRes.json();

        if (regeoData.status !== '1' || !regeoData.regeocode) {
            return res.status(200).json({ result: "查询失败：逆地理编码失败" });
        }
        
        const addrComp = regeoData.regeocode.addressComponent;

        // --- 步骤 3: 智能拼接最终地址 ---
        const province = addrComp.province || "";
        const city = (typeof addrComp.city === 'string' && addrComp.city) ? addrComp.city : province;
        
        const district = (typeof addrComp.district === 'string' && addrComp.district) ? addrComp.district : "";
        const township = (typeof addrComp.township === 'string' && addrComp.township) ? addrComp.township : "";

        let detailedAddress = address.trim();

        // 移除前缀函数
        const removePrefix = (text, prefix) => {
            if (prefix && text.startsWith(prefix)) {
                return text.substring(prefix.length);
            }
            return text;
        };

        // 依次、精确地移除前缀
        detailedAddress = removePrefix(detailedAddress, province);
        detailedAddress = removePrefix(detailedAddress, city);
        detailedAddress = removePrefix(detailedAddress, district);
        detailedAddress = removePrefix(detailedAddress, township);
        if (city) detailedAddress = removePrefix(detailedAddress, city.replace('市', ''));
        if (district) detailedAddress = removePrefix(detailedAddress, district.replace(/[区县市]/g, ''));

        const officialPart = `${province}${city}${district}${township}`;
        const finalAddress = `${officialPart} ${detailedAddress.trim()}`.trim();

        res.status(200).json({ result: finalAddress });

    } catch (error) {
        console.error('Backend Error:', error);
        res.status(500).json({ error: '服务器内部错误，请检查后台日志。', details: error.message });
    }
};

