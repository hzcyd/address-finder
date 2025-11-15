// 这是在后端（服务器）运行的代码
// 它会接收前端的请求，然后用安全的Key去调用高德API

// 智能地址补全函数
function buildCompleteAddress(originalAddress, components) {
    const { province, city, district, township, formattedAddress, detailAddress } = components;

    // 如果有完整的格式化地址，优先使用
    if (formattedAddress && !formattedAddress.includes('null') && !formattedAddress.includes('undefined')) {
        return formattedAddress;
    }

    // 分析原始地址缺失的部分
    const hasProvince = /省/.test(originalAddress) || province === originalAddress.substring(0, originalAddress.indexOf('省') + 1);
    const hasCity = /市/.test(originalAddress) || /北京|上海|天津|重庆/.test(originalAddress);
    const hasDistrict = /区|县/.test(originalAddress);

    let result = '';

    // 补充省份
    if (!hasProvince && province && province !== '[]') {
        result += province;
    }

    // 补充城市
    if (!hasCity && city && city !== '[]') {
        result += city;
    }

    // 补充区县
    if (!hasDistrict && district && district !== '[]') {
        result += district;
    }

    // 补充街道（如果有）
    if (township && township !== '[]' && !originalAddress.includes(township)) {
        result += township;
    }

    // 添加详细地址
    if (detailAddress) {
        result += detailAddress;
    } else {
        // 如果没有详细地址，保留原始输入的详细信息
        result += extractDetailAddress(originalAddress);
    }

    return result.trim();
}

// 提取详细地址部分（去除行政区划）
function extractDetailAddress(address) {
    // 移除省市区县等行政区划，保留具体地址
    let detail = address;
    detail = detail.replace(/.*?省/, '');
    detail = detail.replace(/.*?市/, '');
    detail = detail.replace(/.*?区/, '');
    detail = detail.replace(/.*?县/, '');
    return detail.trim();
}

// 智能猜测补全（当API无结果时的降级方案）
function tryIntelligentCompletion(address) {
    // 常见省份城市映射
    const commonCities = {
        '北京': '北京市',
        '上海': '上海市',
        '天津': '天津市',
        '重庆': '重庆市',
        '绵阳': '四川省绵阳市',
        '成都': '四川省成都市',
        '杭州': '浙江省杭州市',
        '南京': '江苏省南京市',
        '广州': '广东省广州市',
        '深圳': '广东省深圳市'
    };

    // 尝试匹配常见城市
    for (const [shortName, fullName] of Object.entries(commonCities)) {
        if (address.includes(shortName) && !address.includes('省') && !address.includes('市')) {
            return {
                address: fullName + address.replace(shortName, ''),
                message: '根据常见城市名称进行的智能补全'
            };
        }
    }

    return {
        address: address,
        message: '未能查询到该地址的区划信息，请尝试更正地址或使用更通用的地址描述。'
    };
}

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
            const township = geocode.township || ''; // 街道
            const formattedAddress = geocode.formatted_address || ''; // 格式化地址

            // 智能地址补全逻辑
            const completedAddress = buildCompleteAddress(address, {
                province,
                city,
                district,
                township,
                formattedAddress
            });

            return response.status(200).json({
                completedAddress: completedAddress,
                originalAddress: address,
                components: {
                    province,
                    city,
                    district,
                    township
                }
            });

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

                // 智能地址补全逻辑
                const completedAddress = buildCompleteAddress(address, {
                    province,
                    city,
                    district,
                    detailAddress
                });

                return response.status(200).json({
                    completedAddress: completedAddress,
                    originalAddress: address,
                    components: {
                        province,
                        city,
                        district,
                        detailAddress
                    }
                });
            }

            // 如果两个API都没有结果，返回智能猜测结果
            const fallbackResult = tryIntelligentCompletion(address);
            return response.status(200).json({
                completedAddress: fallbackResult.address,
                originalAddress: address,
                isFallback: true,
                message: fallbackResult.message
            });
        }

    } catch (error) {
        console.error("调用高德API时出错:", error);

        // 提供更详细的错误信息
        let errorMessage = '调用地图服务时出错';

        if (error.name === 'FetchError' || error.code === 'ENOTFOUND') {
            errorMessage = '网络连接失败，请检查网络连接或稍后重试';
        } else if (error.name === 'AbortError') {
            errorMessage = '请求超时，请稍后重试';
        } else if (error.message && error.message.includes('timeout')) {
            errorMessage = '请求超时，地图服务响应缓慢，请稍后重试';
        } else if (error.message && error.message.includes('API key')) {
            errorMessage = '服务配置错误，请联系管理员';
        }

        return response.status(500).json({
            message: errorMessage,
            errorType: 'api_error',
            originalError: error.message
        });
    }
};
