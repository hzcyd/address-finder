// 地址智能补全系统 - 全新架构
// 重写版本，采用更清晰、更可靠的设计

/**
 * 地址补全系统主函数
 * @param {Object} request - HTTP请求对象
 * @param {Object} response - HTTP响应对象
 */
module.exports = async (request, response) => {
    // 1. 请求验证
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
        console.error("服务端错误：未配置GAODE_API_KEY环境变量");
        return response.status(500).json({ message: '服务器配置错误' });
    }

    try {
        console.log('开始处理地址:', address);

        // 2. 地址补全处理
        const result = await AddressCompleter.completeAddress(address, apiKey);

        console.log('地址补全结果:', result);

        // 3. 返回结果
        return response.status(200).json({
            completedAddress: result.fullAddress,
            originalAddress: address,
            components: result.components,
            method: result.method,
            confidence: result.confidence
        });

    } catch (error) {
        console.error("地址补全出错:", error);

        // 提供友好的错误信息
        let errorMessage = '地址查询失败，请稍后重试';
        if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = '网络连接失败，请检查网络连接';
        } else if (error.message.includes('API key')) {
            errorMessage = '服务配置错误，请联系管理员';
        }

        return response.status(500).json({
            message: errorMessage,
            errorType: 'processing_error'
        });
    }
};

/**
 * 地址补全器 - 核心业务逻辑
 */
class AddressCompleter {
    // 禁用已知社区映射，完全依赖高德API查询
    // static KNOWN_COMMUNITIES = {};

    /**
     * 补全地址信息
     * @param {string} address - 输入地址
     * @param {string} apiKey - 高德API密钥
     * @returns {Object} 补全结果
     */
    static async completeAddress(address, apiKey) {
        // 1. 预处理：去除多余空格和特殊字符
        const cleanAddress = AddressCleaner.clean(address);

        console.log('使用高德API查询地址:', cleanAddress);

        // 2. 直接调用高德API（禁用预设映射）
        try {
            const apiResult = await this.queryGaodeAPI(cleanAddress, apiKey);
            if (apiResult.isValid) {
                return {
                    ...apiResult,
                    method: 'gaode_api',
                    confidence: apiResult.confidence || 80
                };
            }
        } catch (error) {
            console.log('高德API调用失败:', error.message);
        }

        // 3. 如果高德API无结果，尝试智能降级处理
        console.log('高德API无结果，执行智能降级处理');
        const fallbackResult = this.fallbackCompletion(cleanAddress);
        return {
            ...fallbackResult,
            method: 'intelligent_fallback',
            confidence: 30
        };
    }

    // 已禁用已知社区映射功能，完全依赖高德API

    /**
     * 智能提取详细地址（去除已包含的行政区划）
     * @param {string} originalAddress - 原始地址
     * @param {Object} adminDivisions - 行政区划信息
     * @returns {string} 提取的详细地址
     */
    static extractDetailAddress(originalAddress, adminDivisions) {
        const { province, city, district } = adminDivisions;
        let detail = originalAddress;

        console.log('原始地址:', originalAddress);
        console.log('行政区划:', { province, city, district });

        // 按照从大到小的顺序去除已包含的行政区划
        if (province && detail.includes(province)) {
            detail = detail.replace(province, '');
            console.log(`去除省份: ${province}`);
        }

        if (city && detail.includes(city)) {
            detail = detail.replace(city, '');
            console.log(`去除城市: ${city}`);
        }

        if (district && detail.includes(district)) {
            detail = detail.replace(district, '');
            console.log(`去除区县: ${district}`);
        }

        // 清理结果
        detail = detail.trim().replace(/^[、,，\s]+/, '');

        console.log('提取的详细地址:', detail);
        return detail;
    }

    /**
     * 智能选择最匹配的地理编码结果
     * @param {Array} geocodes - 地理编码结果数组
     * @param {string} address - 原始查询地址
     * @returns {Object} 最佳匹配结果
     */
    static selectBestMatch(geocodes, address) {
        console.log(`从${geocodes.length}个结果中选择最佳匹配`);

        // 计算每个结果的匹配分数
        const scored = geocodes.map(geocode => {
            let score = 0;

            // 优先级1: 包含完整查询地址
            if (geocode.formatted_address.includes(address)) {
                score += 100;
            }

            // 优先级2: 匹配度评估
            const addressParts = address.split(/[省市区县镇乡街道]/);
            for (const part of addressParts) {
                if (part.trim() && geocode.formatted_address.includes(part.trim())) {
                    score += 20;
                }
            }

            // 优先级3: 级别评分
            if (geocode.level === '精确') score += 50;
            else if (geocode.level === '匹配') score += 30;
            else if (geocode.level === '住宅区') score += 20;
            else if (geocode.level === '区县') score += 10;

            return { geocode, score };
        });

        // 按分数排序，选择最高分
        scored.sort((a, b) => b.score - a.score);

        console.log('匹配分数排序:', scored.map(s => ({
            address: s.geocode.formatted_address,
            level: s.geocode.level,
            score: s.score
        })));

        return scored[0].geocode;
    }

    /**
     * 查询高德API
     * @param {string} address - 地址
     * @param {string} apiKey - API密钥
     * @returns {Object} API结果
     */
    static async queryGaodeAPI(address, apiKey) {
        // 构建优化的API请求URL，添加城市参数提高准确性
        let url = `https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodeURIComponent(address)}&output=json`;

        // 如果地址包含省信息，添加city参数
        if (address.includes('成都市')) {
            url += '&city=成都市';
        } else if (address.includes('北京')) {
            url += '&city=北京市';
        } else if (address.includes('上海')) {
            url += '&city=上海市';
        }

        console.log('请求高德API:', url);

        const response = await fetch(url);
        const data = await response.json();

        console.log('高德API完整响应:', JSON.stringify(data, null, 2));

        if (data.status !== '1') {
            throw new Error(`高德API错误: ${data.info}`);
        }

        if (!data.geocodes || data.geocodes.length === 0) {
            console.log('高德API无匹配结果');
            return { isValid: false };
        }

        // 智能选择最匹配的地理编码结果
        const geocode = this.selectBestMatch(data.geocodes, address);
        console.log('选中的地理编码结果:', geocode);

        // 检查关键字段是否为空
        const hasProvince = !!geocode.province;
        const hasCity = !!geocode.city;
        const hasDistrict = !!geocode.district;
        const hasTownship = !!geocode.township;

        console.log('地址组件完整性检查:', {
            hasProvince: hasProvince,
            province: geocode.province,
            hasCity: hasCity,
            city: geocode.city,
            hasDistrict: hasDistrict,
            district: geocode.district,
            hasTownship: hasTownship,
            township: geocode.township,
            formatted_address: geocode.formatted_address
        });

        // 智能提取详细信息（去除已包含的行政区划）
        const detailAddress = this.extractDetailAddress(address, {
            province: geocode.province,
            city: geocode.city,
            district: geocode.district
        });

        // 构建标准化结果，处理数组和字符串类型
        const components = {
            province: geocode.province || '',
            city: geocode.city || '',
            district: geocode.district || '',
            township: Array.isArray(geocode.township) ?
                (geocode.township.length > 0 ? geocode.township[0] : '') :
                (geocode.township || ''),
            detail: detailAddress
        };

        const fullAddress = AddressBuilder.build(components);

        console.log('构建的完整地址:', fullAddress);
        console.log('地址组件:', components);

        return {
            isValid: true,
            fullAddress,
            components,
            confidence: this.calculateConfidence(geocode)
        };
    }

    /**
     * 智能降级补全
     * @param {string} address - 地址
     * @returns {Object} 降级结果
     */
    static fallbackCompletion(address) {
        console.log('执行智能降级补全');

        // 简单的省市区映射
        const cityMappings = {
            '北京': '北京市',
            '上海': '上海市',
            '天津': '天津市',
            '重庆': '重庆市'
        };

        let result = address;

        // 尝试添加城市信息
        for (const [short, full] of Object.entries(cityMappings)) {
            if (address.includes(short) && !address.includes('市')) {
                result = full + address.replace(short, '');
                break;
            }
        }

        return {
            fullAddress: result,
            components: this.parseComponents(result),
            confidence: 30
        };
    }

    /**
     * 计算API结果置信度
     * @param {Object} geocode - 地理编码结果
     * @returns {number} 置信度分数
     */
    static calculateConfidence(geocode) {
        let score = 50; // 基础分

        if (geocode.province) score += 15;
        if (geocode.city) score += 15;
        if (geocode.district) score += 15;
        if (geocode.township) score += 10;

        // 检查级别
        if (geocode.level === '精确') score += 20;
        else if (geocode.level === '匹配') score += 10;

        return Math.min(score, 100);
    }

    /**
     * 简单解析地址组件
     * @param {string} address - 地址
     * @returns {Object} 组件
     */
    static parseComponents(address) {
        return {
            province: address.includes('北京市') ? '北京市' : '',
            city: address.includes('市') ? address.match(/([^省]+市)/)?.[1] : '',
            district: address.match(/([^市]+[区县])/)?.[1] || '',
            township: address.match(/([^区县]+[街道镇乡])/)?.[1] || '',
            detail: address
        };
    }
}

/**
 * 地址清理器
 */
class AddressCleaner {
    /**
     * 清理地址字符串
     * @param {string} address - 原始地址
     * @returns {string} 清理后地址
     */
    static clean(address) {
        return address
            .trim()
            .replace(/\s+/g, '')
            .replace(/[,，、;；]/g, '')
            .replace(/社区$/g, '社区');
    }
}

/**
 * 地址构建器
 */
class AddressBuilder {
    /**
     * 构建完整地址
     * @param {Object} components - 地址组件
     * @returns {string} 完整地址
     */
    static build(components) {
        const { province, city, district, township, detail } = components;

        let address = '';

        // 按照标准顺序组装地址
        if (province && !city.includes(province)) {
            address += province;
        }

        if (city && !address.includes(city)) {
            address += city;
        }

        if (district && !address.includes(district)) {
            address += district;
        }

        // 街道信息是可选的，只有在有值且不重复时才添加
        if (township && typeof township === 'string' && township.trim() && !address.includes(township)) {
            address += township;
        }

        if (detail && !address.includes(detail)) {
            address += detail;
        }

        return address.trim();
    }
}