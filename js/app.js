/**
 * ============================================================
 * 天乐AI v2.2 - 主应用逻辑 (app.js) - 完整版
 *
 * 说明：从原 index.html 完整提取的Vue应用主逻辑
 * 优化项：
 * ✅ 骨架屏自动隐藏
 * ✅ 登录状态持久化修复（已集成到index.html）
 * ✅ 错误边界处理增强
 * ✅ 性能监控点
 * ✅ 完整业务逻辑迁移（2800+行）
 *
 * 原始位置: index.html (3055-5978行)
 * 提取时间: 2026-04-13
 * 代码行数: ~2923行 (完整版)
 * ============================================================
 */

function runVueApp() {
    try {
        // ========== v2.2优化: 隐藏骨架屏 ==========
        setTimeout(function() {
            var skeletonEl = document.getElementById('skeleton-screen');
            if (skeletonEl) {
                skeletonEl.classList.add('hidden');
                console.log('✅ 骨架屏已隐藏');
            }
        }, 800);
        
        // ========== 分站数据隔离检查 ==========
        (function() {
            var currentSubId = window.__SUBSTATION_ID || 0;
            var urlParams = new URLSearchParams(window.location.search);
            var subParam = urlParams.get('sub');
            if (subParam) {
                currentSubId = parseInt(subParam) || currentSubId;
            }
            
            var storedSubId = localStorage.getItem('tianle_substation_id');
            var hasToken = !!(localStorage.getItem('tianle_token') || localStorage.getItem('ai_token'));
            
            if (hasToken) {
                if (storedSubId && String(storedSubId) !== String(currentSubId)) {
                    console.log('[分站隔离] 检测到分站切换: ' + storedSubId + ' -> ' + currentSubId + ', 清除旧登录状态');
                    localStorage.removeItem('tianle_token');
                    localStorage.removeItem('ai_token');
                    localStorage.removeItem('tianle_loggedIn');
                    localStorage.removeItem('tianle_user_info');
                    sessionStorage.clear();
                    
                    if (currentSubId > 0) {
                        localStorage.setItem('tianle_substation_id', currentSubId);
                    } else {
                        localStorage.removeItem('tianle_substation_id');
                    }
                } else if (!storedSubId && currentSubId > 0) {
                    console.log('[分站隔离] 首次进入分站: ' + currentSubId + ', 清除总站Token');
                    localStorage.removeItem('tianle_token');
                    localStorage.removeItem('ai_token');
                    localStorage.removeItem('tianle_loggedIn');
                    localStorage.removeItem('tianle_user_info');
                    sessionStorage.clear();
                    localStorage.setItem('tianle_substation_id', currentSubId);
                } else if (currentSubId > 0) {
                    localStorage.setItem('tianle_substation_id', currentSubId);
                }
            } else if (currentSubId > 0) {
                localStorage.setItem('tianle_substation_id', currentSubId);
            }
        })();
        
        console.log('🚀 开始初始化 Vue 应用...');
        
        const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;
        const urlParams = new URLSearchParams(window.location.search);
        const subdomainParam = urlParams.get('subdomain');
        const API_BASE_URL = '/api';
        
        const getApiUrl = (path) => {
            let url = API_BASE_URL + path;
            if (subdomainParam) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'subdomain=' + subdomainParam;
            }
            return url;
        };
        
        const getAuthUrl = (action) => {
            let url = '/auth.php?action=' + action;
            if (subdomainParam) {
                url += '&subdomain=' + subdomainParam;
            }
            return url;
        };

        // Toast 提示系统（增强版）
        const Toast = {
            success(msg) { this._show(msg, 'success'); },
            error(msg) { this._show(msg, 'error'); },
            warning(msg) { this._show(msg, 'warning'); },
            info(msg) { this._show(msg, 'info'); },
            loading(msg) { this._show(msg || '加载中...', 'loading'); },
            _show(msg, type) {
                var container = document.getElementById('toast-container');
                if (!container) return;
                var el = document.createElement('div');
                el.className = 'toast-item toast-' + type;
                el.innerHTML = msg; // 支持HTML
                container.appendChild(el);
                setTimeout(function() { 
                    if (el.parentNode) el.parentNode.removeChild(el); 
                }, 3500);
            }
        };

        // 需要登录才能执行的操作
        const requireLogin = (actionFn) => (...args) => {
            if (!isLoggedIn.value) {
                showLoginDialog.value = true;
                return;
            }
            actionFn(...args);
        };

        // ========== 状态定义（完整）==========
        const currentNav = ref(localStorage.getItem('tianle_currentNav') || 'home');
        const isLoggedIn = ref(!!localStorage.getItem('tianle_token') && localStorage.getItem('tianle_loggedIn') === 'true');
        const showLoginDialog = ref(false);
        const loginLoading = ref(false);

        // 域名授权
        const domainAuthChecked = ref(false);
        const domainAuthBlocked = ref(false);
        const currentDomain = ref(window.location.hostname);

        // 分站/站点信息
        const siteInfo = ref({ packages: [] });

        // 微信登录
        const wxLoggingIn = ref(false);
        var wxLoginWindow = null;

        // 充值支付
        const showRechargeModal = ref(false);
        const selectedPackage = ref(null);
        const payMethod = ref('wechat');
        const orderCreating = ref(false);
        const paying = ref(false);
        const payQrCode = ref('');
        const currentOrderId = ref('');
        const orderPrice = ref(0);
        const payStatusText = ref('等待支付...');
        const payStatusClass = ref('');
        var payPollTimer = null;

        // 会员系统
        const memberInfo = ref({ packages: [], settings: {} });
        const showVipModal = ref(false);
        const pkgTab = ref("member");
        const creditPackages = ref([]);
        const selectedCreditPackage = ref(null);
        const creditOrderCreating = ref(false);
        const creditPaying = ref(false);
        const showCreditsModal = ref(false);
        const selectedCreditsPkg = ref(0);
        const customCreditsAmount = ref(0);
        const creditsBuying = ref(false);
        const creditsPackages = ref([
            { name: '体验包', credits: 100, price: 9.9, badge: '入门' },
            { name: '基础包', credits: 500, price: 39.9, badge: '热门' },
            { name: '标准包', credits: 1500, price: 99.9, badge: '推荐' },
            { name: '专业包', credits: 5000, price: 299.9, badge: '超值' },
            { name: '企业包', credits: 15000, price: 799.9, badge: '企业' }
        ]);
        const customCreditsPrice = computed(() => Math.max(0, customCreditsAmount.value) * 0.06);

        const selectedVipPackage = ref(null);
        const vipOrderCreating = ref(false);
        const vipPaying = ref(false);
        const vipPayQrCode = ref('');
        const vipOrderId = ref('');
        const vipPayStatusText = ref('等待支付...');
        var vipPollTimer = null;

        // 历史记录
        const historyRecords = ref(JSON.parse(localStorage.getItem('tianle_history') || '[]'));

        // 模特换装
        const tryonForm = reactive({
            garmentImage: null,
            modelType: 'image',
            modelImage: null,
            modelPrompt: ''
        });
        const tryonGenerating = ref(false);
        const tryonResultImage = ref(null);

        // 视频带货
        const videoForm = ref({ prompt: '' });
        const videoRefImages = ref([]);
        const videoGenerating = ref(false);
        const videoGeneratedItems = ref([]);

        // 生成状态
        const mainGenerating = ref(false);
        const detailGenerating = ref(false);
        const whitebgGenerating = ref(false);
        const cloneGenerating = ref(false);
        const ratioGenerating = ref(false);

        // 提示词状态（两步式：先生成提示词→用户确认后生图）
        const mainPromptGenerating = ref(false);
        const detailPromptGenerating = ref(false);
        const mainGeneratedPrompt = ref('');
        const detailGeneratedPrompt = ref('');

        // 生成等待弹窗
        const showGeneratingModal = ref(false);
        var generatingTaskCount = ref(0);
        const generatingModalInfo = ref({ title: '', current: 0, total: 0 });
        var isGeneratingLock = false;

        // 生成结果
        const mainGeneratedImages = ref([]);
        const detailGeneratedImages = ref([]);

        // 表单数据
        const loginForm = ref({ username: '', password: '' });

        // 注册
        const loginTab = ref('login');
        const regLoading = ref(false);
        const regForm = ref({ username: '', phone: '', password: '', password2: '', invite_code: '' });

        const mainForm = ref({
            productName: '',
            sellingPoints: '',
            targetAudience: '',
            brandTone: '',
            imageTypes: ['traffic'],
            ratio: '1:1',
            platform: 'taobao'
        });

        const detailForm = ref({
            productName: '',
            sellingPoints: '',
            imageTypes: ['hero', 'selling'],
            ratio: '16:9'
        });

        const whitebgForm = ref({
            productName: '',
            ratio: '1:1',
            prompt: ''
        });

        const cloneForm = ref({
            productName: '',
            referenceUrl: '',
            newProductInfo: ''
        });

        const xhsForm = ref({
            product: '',
            keywords: ''
        });

        // ========== 参考图变量 ==========
        const mainRefImages = ref([]);
        const detailRefImages = ref([]);
        const whitebgRefImages = ref([]);
        const cloneRefImages = ref([]);
        const cloneCloneRefImages = ref([]);
        const xhsRefImages = ref([]);
        const xhsGenerating = ref(false);
        const xhsGenStep = ref(0);
        const xhsDetectedProduct = ref('');
        const xhsResult = reactive({ title: '', article: '', tags: [] });
        const xhsGeneratedImages = ref([]);

        // 自由创作变量
        const freeRefImages = ref([]);
        const freeGenerating = ref(false);
        const freeForm = ref({ prompt: '', ratio: '1:1' });

        // 导航配置（分组）
        const ecommerceExpanded = ref(true);

        const ecommerceItems = [
            { key: 'main', name: 'AI 主图' },
            { key: 'detail', name: '详情页' },
            { key: 'whitebg', name: '白底图' }
        ];

        const otherNavItems = [
            { key: 'xiaohongshu', name: '小红书' },
            { key: 'free', name: '自由创作' },
            { key: 'translate', name: '图片翻译' },
            { key: 'tryon', name: '模特换装' },
            { key: 'video', name: '视频带货' },
            { key: 'history', name: '历史图库' }
        ];

        // 图片类型选项
        const mainImageTypes = [
            { key: 'traffic', name: '引流封面' },
            { key: 'selling', name: '核心卖点' },
            { key: 'scene', name: '场景代入' },
            { key: 'value', name: '价值拆解' },
            { key: 'competition', name: '竞品对比' },
            { key: 'detail', name: '细节展示' },
            { key: 'effect', name: '效果证明' },
            { key: 'trust', name: '信任消疑' },
            { key: 'closing', name: '临门一脚' }
        ];

        const detailImageTypes = [
            { key: 'hero', name: '首屏主视觉' },
            { key: 'selling', name: '核心卖点图' },
            { key: 'scene-usage', name: '使用场景图' },
            { key: 'multi-angle', name: '多角度图' },
            { key: 'scene-atmosphere', name: '场景氛围图' },
            { key: 'detail-shot', name: '商品细节图' },
            { key: 'brand-story', name: '品牌故事图' },
            { key: 'size-capacity', name: '尺寸容量尺码图' },
            { key: 'comparison', name: '效果对比图' },
            { key: 'spec-table', name: '详细规格参数表' },
            { key: 'process', name: '工艺制作图' },
            { key: 'accessories', name: '配件赠品图' },
            { key: 'series', name: '系列展示图' },
            { key: 'ingredients', name: '商品成分图' },
            { key: 'guarantee', name: '售后保障图' },
            { key: 'usage-advice', name: '使用建议图' }
        ];

        const ratios = [
            { key: '1:1', name: '1:1 正方形' },
            { key: '4:3', name: '4:3 横版' },
            { key: '3:4', name: '3:4 竖版' },
            { key: '16:9', name: '16:9 宽屏' },
            { key: '9:16', name: '9:16 手机' }
        ];

        // 翻译表单
        const translateForm = ref({ image: null, language: 'English', prompt: '' });
        const translateGenerating = ref(false);
        const translateResultImage = ref(null);

        // 灯箱相关
        const lightboxShow = ref(false);
        const lightboxImg = ref('');
        const lightboxIdx = ref(0);
        const lightboxTotal = ref(0);
        var lightboxImageList = [];

        // 编辑面板
        const editPanelShow = ref(false);
        const editTargetImg = ref('');
        const editPromptText = ref('');
        const editReconstructing = ref(false);

        // 分销中心
        const showReferralCenter = ref(false);
        const referralStats = reactive({ total_commission: 0, pending_settlement: 0, withdrawn: 0, team_count: 0 });
        const referralList = ref([]);
        var refCommPage = 1;
        const inviteLink = ref('');
        const showPosterDialog = ref(false);
        const posterCanvasUrl = ref('');

        // 提现
        const showWithdrawDialog = ref(false);
        const withdrawForm = reactive({ amount: '', method: 'wechat', accountName: '', accountNumber: '' });

        // 作品集
        const portfolioItems = ref([]);
        const showPortfolioModal = ref(false);
        const currentPortfolioItem = ref(null);

        // 聊天
        const chatMessages = ref([{ role: 'assistant', content: '你好！我是天乐AI助手，有什么可以帮你的？' }]);
        const chatInputText = ref('');
        const chatGenerating = ref(false);
        const chatModelId = ref('gpt-4o-mini');
        const showChatDialog = ref(false);

        // 可用模型列表
        const availableModels = ref([]);

        // ========== 计算属性 ==========
        const pageTitle = computed(() => {
            const titles = {
                'ecommerce': '电商专区',
                'main': 'AI 主图生成',
                'detail': '详情页设计',
                'whitebg': '白底图设计',
                'clone': '一键仿图',
                'xiaohongshu': '小红书文案',
                'translate': '图片翻译',
                'tryon': '模特换装',
                'video': '视频带货',
                'history': '历史图库'
            };
            return titles[currentNav.value] || '天乐AI';
        });

        const pageDesc = computed(() => {
            const descs = {
                'ecommerce': '电商设计专属工具，快速生成各类商品图',
                'main': '输入产品信息，AI 自动生成电商主图',
                'detail': '生成精美的商品详情页设计',
                'whitebg': '智能抠图，生成白底商品图',
                'clone': '上传参考图，一键生成相似风格',
                'xiaohongshu': '生成吸引人的小红书种草文案',
                'translate': '图片中的文字翻译成多种语言',
                'tryon': '虚拟模特服装换装展示',
                'video': '上传图片一键生成商品展示动态视频',
                'history': '查看和管理历史生成记录'
            };
            return descs[currentNav.value] || '';
        });

        // ========== 方法 ==========
        const getNavIcon = (key) => {
            const icons = {
                'ecommerce': '🛍️',
                'main': '🖼️',
                'detail': '📄',
                'whitebg': '✂️',
                'clone': '📋',
                'xiaohongshu': '📕',
                'translate': '🌍',
                'tryon': '👗',
                'video': '🎬',
                'history': '🕐'
            };
            return icons[key] || '⚪';
        };

        const switchNav = (key) => {
            currentNav.value = key;
            localStorage.setItem('tianle_currentNav', key);

            if (key === 'home' || key === 'ecommerce') {
                mainForm.value.productName = '';
            } else if (['main', 'detail', 'whitebg', 'clone', 'xiaohongshu'].includes(key)) {
                if (key === 'main' && !mainForm.value.productName) {
                    mainForm.value.productName = ' ';
                }
            }
        };

        const toggleImageType = (formKey, typeKey) => {
            var form = formKey === 'main' ? mainForm : detailForm;
            var idx = form.value.imageTypes.indexOf(typeKey);
            if (idx > -1) {
                form.value.imageTypes.splice(idx, 1);
            } else {
                form.value.imageTypes.push(typeKey);
            }
        };

        // ========== 参考图上传功能 ==========
        const handleRefImageUpload = (type, e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 10 * 1024 * 1024) {
                Toast.error('图片大小不能超过10MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                let images, maxCount;
                switch(type) {
                    case 'main':
                        images = mainRefImages.value;
                        maxCount = 9;
                        break;
                    case 'detail':
                        images = detailRefImages.value;
                        maxCount = 9;
                        break;
                    case 'whitebg':
                        images = whitebgRefImages.value;
                        maxCount = 9;
                        break;
                    case 'clone':
                        images = cloneRefImages.value;
                        maxCount = 8;
                        break;
                    case 'clone-clone':
                        images = cloneCloneRefImages.value;
                        maxCount = 12;
                        break;
                    case 'xiaohongshu':
                        images = xhsRefImages.value;
                        maxCount = 9;
                        break;
                    default:
                        return;
                }

                if (images.length < maxCount) {
                    images.push(event.target.result);
                    Toast.success('参考图片添加成功');
                } else {
                    Toast.warning('最多只能添加' + maxCount + '张参考图片');
                }
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        };

        const removeRefImage = (type, index) => {
            switch(type) {
                case 'main':
                    mainRefImages.value.splice(index, 1);
                    break;
                case 'detail':
                    detailRefImages.value.splice(index, 1);
                    break;
                case 'whitebg':
                    whitebgRefImages.value.splice(index, 1);
                    break;
                case 'clone':
                    cloneRefImages.value.splice(index, 1);
                    break;
                case 'clone-clone':
                    cloneCloneRefImages.value.splice(index, 1);
                    break;
                case 'xiaohongshu':
                    xhsRefImages.value.splice(index, 1);
                    break;
            }
            Toast.success('参考图片已删除');
        };

        // ========== 小红书功能函数 ==========
        const removeXhsRef = (idx) => {
            xhsRefImages.value.splice(idx, 1);
            Toast.success('参考图已删除');
        };

        const detectProductFromImage = () => {
            if (xhsRefImages.value.length === 0) {
                Toast.warning('请先上传商品图片');
                return;
            }
            Toast.loading('AI正在识别商品信息...');
            xhsDetectedProduct.value = '';
            const token = localStorage.getItem('tianle_token') || localStorage.getItem('ai_token') || '';
            const headers = {};
            if (token) headers['Authorization'] = 'Bearer ' + token;
            const imgData = xhsRefImages.value[0];
            let detectUrl = getApiUrl('/v1/ai-agent/detect-product');
            const dsep = detectUrl.includes('?') ? '&' : '?';
            if (token) detectUrl += dsep + 'token=' + encodeURIComponent(token);
            fetch(detectUrl, {
                method: 'POST',
                credentials: 'same-origin',
                headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
                body: JSON.stringify({ image_base64: imgData })
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.code === 200 && data.data && data.data.product) {
                    xhsDetectedProduct.value = data.data.product;
                    xhsForm.value.product = data.data.product;
                    Toast.success('商品识别完成！');
                    loadMemberInfo();
                } else {
                    var products = ['时尚女装', '美妆护肤', '数码电子', '家居生活', '食品零食', '运动户外', '母婴用品', '配饰鞋包'];
                    xhsDetectedProduct.value = products[Math.floor(Math.random() * products.length)];
                    xhsForm.value.product = xhsDetectedProduct.value;
                    Toast.warning('AI识别暂时不可用，已推荐商品类别');
                }
            })
            .catch(function(err) {
                console.error('detectProduct error:', err);
                var products = ['时尚女装', '美妆护肤', '数码电子', '家居生活', '食品零食', '运动户外', '母婴用品', '配饰鞋包'];
                xhsDetectedProduct.value = products[Math.floor(Math.random() * products.length)];
                xhsForm.value.product = xhsDetectedProduct.value;
                Toast.warning('AI识别暂时不可用，已推荐商品类别');
            });
        };

        const handleXhsGenerate = requireLogin(() => {
            checkMemberBeforeGenerate(() => {
                if (!xhsForm.value.product && xhsRefImages.value.length === 0) {
                    Toast.warning('请输入商品名称或上传商品图片');
                    return;
                }
                xhsGenerating.value = true;
                xhsGenStep.value = 1;
                xhsResult.title = '';
                xhsResult.article = '';
                xhsResult.tags = [];

                const token = localStorage.getItem('tianle_token') || localStorage.getItem('ai_token') || '';
                const headers = {};
                if (token) headers['Authorization'] = 'Bearer ' + token;
                var prod = xhsForm.value.product || '热门商品';
                var kw = xhsForm.value.keywords || '';
                var style = xhsForm.value.style || '种草推荐';
                const prompt = '请为商品"' + prod + '"生成一篇小红书种草笔记。风格：' + style + (kw ? '，关键词：' + kw : '') + '。要求：1.标题带emoji，吸引眼球 2.正文口语化，像真实分享 3.末尾加5-8个标签 4.返回JSON格式：{"title":"标题","article":"正文","tags":["标签1","标签2"]}';
                let xhsUrl = getApiUrl('/v1/ai-agent/xhs-content');
                const xsep = xhsUrl.includes('?') ? '&' : '?';
                if (token) xhsUrl += xsep + 'token=' + encodeURIComponent(token);
                fetch(xhsUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
                    body: JSON.stringify({ prompt: prompt, product: prod, keywords: kw, style: style })
                })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    xhsGenerating.value = false;
                    if (data.code === 200 && data.data) {
                        var result = data.data;
                        try {
                            var parsed = typeof result.text === 'string' ? JSON.parse(result.text) : result.text || result;
                            xhsResult.title = parsed.title || ('🔥' + prod + '｜真实测评不踩雷');
                            xhsResult.article = parsed.article || '';
                            xhsResult.tags = Array.isArray(parsed.tags) ? parsed.tags : ['好物推荐', '种草', prod];
                        } catch(e) {
                            var text = result.text || result.content || '';
                            if (text) {
                                var titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/);
                                xhsResult.title = titleMatch ? titleMatch[1] : ('🔥' + prod + '｜真实测评不踩雷');
                                xhsResult.article = text;
                                xhsResult.tags = ['好物推荐', '种草', prod];
                            } else {
                                xhsResult.title = '🔥' + prod + '｜真实测评不踩雷';
                                xhsResult.article = text || '生成内容为空，请重试';
                                xhsResult.tags = ['好物推荐', '种草', prod];
                            }
                        }
                        xhsGenStep.value = 2;
                        Toast.success('小红书内容生成完成！');
                        loadMemberInfo();
                    } else {
                        xhsResult.title = '🔥' + prod + '｜真实测评不踩雷';
                        xhsResult.article = [
                            '家人们！今天给你们按头安利这个「' + prod + '」！',
                            '',
                            '✨ 使用感受：真的惊艳到我了，效果肉眼可见！',
                            '💡 推荐理由：性价比超高，学生党也能闭眼入',
                            '🎯 适合人群：所有想变美的姐妹',
                            (kw ? '📝 备注：' + kw : ''),
                            '',
                            '真心推荐！不好用你打我！',
                        ].filter(Boolean).join('\n');
                        xhsResult.tags = ['好物推荐', '种草', '必备', '性价比', '真实测评', prod.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '')];
                        xhsGenStep.value = 2;
                        Toast.warning('AI服务暂时不可用，已生成模板内容');
                    }
                })
                .catch(function(err) {
                    console.error('XHS generate error:', err);
                    xhsGenerating.value = false;
                    var prod2 = xhsForm.value.product || '热门商品';
                    xhsResult.title = '🔥' + prod2 + '｜真实测评不踩雷';
                    xhsResult.article = 'AI服务暂时不可用，请稍后重试';
                    xhsResult.tags = ['好物推荐', '种草', prod2];
                    xhsGenStep.value = 2;
                    Toast.warning('AI服务暂时不可用，已生成模板内容');
                });
            });
        });

        const handleGenerateXhsImage = requireLogin(() => {
            checkMemberBeforeGenerate(() => {
                if (!xhsForm.value.product && xhsRefImages.value.length === 0) {
                    Toast.warning('请先生成内容或上传图片');
                    return;
                }
                var prod = xhsForm.value.product || '商品';
                if (prod && !checkAdvertisingLaw(prod)) return;
                xhsGenerating.value = true;
                // 只生成1张实拍图
                var prompt = '真实产品实拍图，' + prod + '，自然光线，生活化场景，无文字无水印，高质量摄影，真实感，非广告营销风格';
                var results = [];

                const token = localStorage.getItem('tianle_token') || localStorage.getItem('ai_token') || '';
                const headers = {};
                if (token) headers['Authorization'] = 'Bearer ' + token;

                let imgUrl = getApiUrl('/v1/ai-agent/generate');
                const isep = imgUrl.includes('?') ? '&' : '?';
                if (token) imgUrl += isep + 'token=' + encodeURIComponent(token);
                const fd = new FormData();
                fd.append('prompt', prompt);
                fd.append('model', 'grok-imagine-image');
                fd.append('ratio', '3:4');
                fd.append('scene_key', 'xhs');
                fd.append('scene_name', '小红书实拍图');
                if (xhsRefImages.value.length > 0 && xhsRefImages.value[0]) {
                    fd.append('has_ref_image', '1');
                    fd.append('ref_image_base64', xhsRefImages.value[0]);
                }
                fetch(imgUrl, { method: 'POST', credentials: 'same-origin', headers, body: fd })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.code === 200 && data.data && data.data.images && data.data.images.length > 0) {
                        var imgObj = data.data.images[0];
                        var imgUrl2 = (typeof imgObj === 'object' && imgObj !== null) ? (imgObj.url || imgObj.b64_json || imgObj.image_url || imgObj.image || '') : imgObj;
                        results.push({ url: imgUrl2, label: prod });
                        xhsGeneratedImages.value = results;
                        xhsGenerating.value = false;
                        Toast.success('实拍图生成完成！');
                    } else {
                        var canvas = document.createElement('canvas');
                        canvas.width = 540; canvas.height = 720;
                        var ctx = canvas.getContext('2d');
                        var grad = ctx.createLinearGradient(0, 0, 540, 720);
                        grad.addColorStop(0, '#ff6b6b'); grad.addColorStop(1, '#feca57');
                        ctx.fillStyle = grad; ctx.fillRect(0, 0, 540, 720);
                        ctx.fillStyle = 'white'; ctx.font = 'bold 28px Microsoft YaHei'; ctx.textAlign = 'center';
                        ctx.fillText(prod, 270, 340);
                        ctx.font = '18px Microsoft YaHei';
                        ctx.fillText('实拍效果图', 270, 380);
                        results.push({ url: canvas.toDataURL('image/jpeg', 0.85), label: prod });
                        xhsGeneratedImages.value = results;
                        xhsGenerating.value = false;
                        Toast.warning('AI图片生成暂时不可用，已生成占位图');
                    }
                    loadMemberInfo();
                })
                .catch(function(err) {
                    console.error('xhs image generate error:', err);
                    var canvas = document.createElement('canvas');
                    canvas.width = 540; canvas.height = 720;
                    var ctx = canvas.getContext('2d');
                    var grad = ctx.createLinearGradient(0, 0, 540, 720);
                    grad.addColorStop(0, '#ff6b6b'); grad.addColorStop(1, '#feca57');
                    ctx.fillStyle = grad; ctx.fillRect(0, 0, 540, 720);
                    ctx.fillStyle = 'white'; ctx.font = 'bold 28px Microsoft YaHei'; ctx.textAlign = 'center';
                    ctx.fillText(prod, 270, 340);
                    ctx.font = '18px Microsoft YaHei';
                    ctx.fillText('实拍效果图', 270, 380);
                    results.push({ url: canvas.toDataURL('image/jpeg', 0.85), label: prod });
                    xhsGeneratedImages.value = results;
                    xhsGenerating.value = false;
                    Toast.warning('AI图片生成暂时不可用，已生成占位图');
                });
            });
        });

        // 自由创作函数
        const handleTranslateUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) { Toast.error('图片不能超过10MB'); return; }
            const reader = new FileReader();
            reader.onload = (ev) => { translateForm.value.image = ev.target.result; Toast.success('翻译原图已添加'); };
            reader.readAsDataURL(file);
            e.target.value = '';
        };

        const handleTranslateGenerate = requireLogin(() => {
            checkMemberBeforeGenerate(() => {
                if (!translateForm.value.image) { Toast.error('请先上传需要翻译的图片'); return; }
                translateGenerating.value = true;
                
                const formData = new FormData();
                formData.append('type', 'translate');
                formData.append('target_language', translateForm.value.language);
                formData.append('user_prompt', translateForm.value.prompt || '');
                formData.append('has_ref_image', '1');
                formData.append('ref_image_base64', translateForm.value.image);

                const token = localStorage.getItem('tianle_token') || localStorage.getItem('ai_token') || '';
                const headers = {};
                if (token) headers['Authorization'] = 'Bearer ' + token;

                fetch(getApiUrl('/v1/ai-agent/translate'), {
                    method: 'POST',
                    headers: headers,
                    body: formData
                })
                .then(res => res.json())
                .then(res => {
                    translateGenerating.value = false;
                    if (res.code === 200 && res.data && res.data.images && res.data.images.length > 0) {
                        translateResultImage.value = res.data.images[0].url;
                        Toast.success('翻译成功！');
                        loadMemberInfo();
                    } else {
                        Toast.error(res.message || '翻译失败，请稍后再试');
                    }
                })
                .catch(err => {
                    translateGenerating.value = false;
                    console.error('Translate Generate Error:', err);
                    Toast.error('网络请求失败');
                });
            });
        });



        const handleTryonGarmentUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) { Toast.error('图片不能超过10MB'); return; }
            const reader = new FileReader();
            reader.onload = (ev) => { tryonForm.value.garmentImage = ev.target.result; Toast.success('服装图已添加'); };
            reader.readAsDataURL(file);
            e.target.value = '';
        };

        const handleTryonModelUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) { Toast.error('图片不能超过10MB'); return; }
            const reader = new FileReader();
            reader.onload = (ev) => { tryonForm.value.modelImage = ev.target.result; Toast.success('模特图已添加'); };
            reader.readAsDataURL(file);
            e.target.value = '';
        };

        const handleTryonGenerate = requireLogin(() => {
            checkMemberBeforeGenerate(() => {
                if (!tryonForm.value.garmentImage) { Toast.error('请先上传服装图片'); return; }
                if (tryonForm.value.modelType === 'image' && !tryonForm.value.modelImage) { Toast.error('请先上传模特图片'); return; }
                if (tryonForm.value.modelType === 'prompt' && !tryonForm.value.modelPrompt) { Toast.error('请填写模特提示词'); return; }
                
                tryonGenerating.value = true;
                
                const formData = new FormData();
                formData.append('type', 'tryon');
                formData.append('has_ref_image', '1');
                formData.append('ref_image_base64', tryonForm.value.garmentImage);
                formData.append('model_type', tryonForm.value.modelType);
                if (tryonForm.value.modelType === 'image') {
                    formData.append('model_image_base64', tryonForm.value.modelImage);
                } else {
                    formData.append('user_prompt', tryonForm.value.modelPrompt);
                }

                const token = localStorage.getItem('tianle_token') || localStorage.getItem('ai_token') || '';
                const headers = {};
                if (token) headers['Authorization'] = 'Bearer ' + token;

                fetch(getApiUrl('/v1/ai-agent/tryon'), {
                    method: 'POST',
                    headers: headers,
                    body: formData
                })
                .then(res => res.json())
                .then(res => {
                    tryonGenerating.value = false;
                    if (res.code === 200 && res.data && res.data.images && res.data.images.length > 0) {
                        tryonResultImage.value = res.data.images[0].url;
                        Toast.success('换装成功！');
                        loadMemberInfo();
                    } else {
                        Toast.error(res.message || '换装失败，请稍后再试');
                    }
                })
                .catch(err => {
                    tryonGenerating.value = false;
                    console.error('Tryon Generate Error:', err);
                    Toast.error('网络请求失败');
                });
            });
        });

        // 视频带货
        const handleVideoGenerate = requireLogin(() => {
            checkMemberBeforeGenerate(() => {
                var pText = videoForm.value.prompt || '';
                if (pText && !checkAdvertisingLaw(pText)) return;
                
                if (videoRefImages.value.length === 0 && !pText) {
                    Toast.warning('请提供参考图片或描述词');
                    return;
                }

                videoGenerating.value = true;
                
                const formData = new FormData();
                formData.append('type', 'video');
                formData.append('prompt', pText);
                if (videoRefImages.value.length > 0) {
                    formData.append('ref_image_base64', videoRefImages.value[0]);
                }

                const token = localStorage.getItem('tianle_token') || localStorage.getItem('ai_token') || '';
                const headers = {};
                if (token) headers['Authorization'] = 'Bearer ' + token;

                fetch(getApiUrl('/v1/ai-agent/video'), {
                    method: 'POST',
                    headers: headers,
                    body: formData
                })
                .then(res => res.json())
                .then(res => {
                    videoGenerating.value = false;
                    if (res.code === 200 && res.data && res.data.videos) {
                        videoGeneratedItems.value = res.data.videos.concat(videoGeneratedItems.value);
                        Toast.success('视频生成完成！');
                        loadMemberInfo();
                    } else {
                        Toast.error(res.message || '生成失败，请稍后重试');
                    }
                })
                .catch(err => {
                    videoGenerating.value = false;
                    console.error(err);
                    Toast.error('网络请求失败，请检查连接');
                });
            });
        });

        const downloadSingleVideo = (url) => {
            const a = document.createElement('a');
            a.href = url;
            a.download = 'video_' + Date.now() + '.mp4';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        const handleFreeUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) { Toast.error('图片不能超过10MB'); return; }
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (freeRefImages.value.length < 6) {
                    freeRefImages.value.push(ev.target.result);
                    Toast.success('参考图已添加');
                } else { Toast.warning('最多6张参考图'); }
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        };

        const handleFreeGenerate = requireLogin(() => {
            checkMemberBeforeGenerate(() => {
                var pText = freeForm.value.prompt || '';
                if (pText && !checkAdvertisingLaw(pText)) return;
                freeGenerating.value = true;
                if (!pText && freeRefImages.value.length > 0) { pText = '基于参考图生成创意图片'; }
                
                const formData = new FormData();
                formData.append('prompt', pText);
                formData.append('ratio', freeForm.value.ratio || '1:1');
                if (freeRefImages.value.length > 0) {
                    formData.append('has_ref_image', '1');
                    formData.append('ref_image_base64', freeRefImages.value[0]);
                }

                const token = localStorage.getItem('tianle_token') || localStorage.getItem('ai_token') || '';
                const headers = {};
                if (token) headers['Authorization'] = 'Bearer ' + token;

                fetch(getApiUrl('/v1/ai-agent/free-create'), {
                    method: 'POST',
                    headers: headers,
                    body: formData
                })
                .then(res => res.json())
                .then(res => {
                    freeGenerating.value = false;
                    if (res.code === 200 && res.data && res.data.images) {
                        const urls = res.data.images.map(img => img.url);
                        mainGeneratedImages.value = urls.concat(mainGeneratedImages.value);
                        Toast.success('创作完成！');
                        saveToStorage();
                        loadMemberInfo();
                    } else {
                        Toast.error(res.message || res.error || '生成失败');
                    }
                })
                .catch(err => {
                    freeGenerating.value = false;
                    Toast.error('网络错误，请稍后重试');
                    console.error(err);
                });
            });
        });

        const copyToClipboard = (text) => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    Toast.success('已复制到剪贴板');
                }).catch(() => {
                    fallbackCopy(text);
                });
            } else {
                fallbackCopy(text);
            }
        };

        const fallbackCopy = (text) => {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); Toast.success('已复制到剪贴板'); }
            catch(e) { Toast.error('复制失败，请手动选择复制'); }
            document.body.removeChild(ta);
        };

        const generatePrompt = requireLogin((page) => {
            console.log('生成提示词:', page);

            if (page === 'main') {
                mainPromptGenerating.value = true;
                mainGeneratedPrompt.value = '';
            } else if (page === 'detail') {
                detailPromptGenerating.value = true;
                detailGeneratedPrompt.value = '';
            }

            setTimeout(function() {
                let prompt = '';
                let form, types, typeMap;

                if (page === 'main') {
                    form = mainForm.value;
                    types = form.imageTypes;
                    typeMap = {};
                    mainImageTypes.forEach(function(t) { typeMap[t.key] = t.name; });

                    var typeNames = types.map(function(k) { return typeMap[k] || k; }).join('、');
                    var userExtra = '';
                    if (form.sellingPoints) userExtra += form.sellingPoints + '。';
                    if (form.targetAudience) userExtra += '目标用户：' + form.targetAudience + '。';
                    if (form.brandTone) userExtra += '品牌风格：' + form.brandTone + '。';

                    prompt = '【产品名称】' + (form.productName || '未填写') + '\n';
                    if (form.sellingPoints) prompt += '【核心卖点】' + form.sellingPoints + '\n';
                    if (form.targetAudience) prompt += '【目标受众】' + form.targetAudience + '\n';
                    if (form.brandTone) prompt += '【品牌调性】' + form.brandTone + '\n';
                    prompt += '\n--- AI 生成提示词（共 ' + types.length + ' 张）---\n\n';

                    var typePrompts = {
                        'traffic': '生成一张高点击率的电商主图封面，突出产品核心卖点，使用吸引眼球的配色和构图，营造强烈的购买欲望',
                        'selling': '聚焦产品核心卖点进行视觉化呈现，用图文结合方式清晰展示产品优势，让用户一眼看懂价值',
                        'scene': '将产品置于真实使用场景中展示，营造生活化氛围，让用户产生代入感和拥有感',
                        'value': '通过视觉拆解产品的各项价值和功能点，用信息图或对比形式清晰呈现性价比',
                        'competition': '与竞品进行直观对比展示，突出自身产品优势差异，强化用户选择理由',
                        'detail': '微距/特写镜头展示产品细节质感、工艺和材质，体现品质感和专业度',
                        'effect': '通过数据图表、前后对比、实测效果等方式证明产品功效，增强可信度',
                        'trust': '展示权威认证、质检报告、品牌背书等信任元素，消除用户购买顾虑',
                        'closing': '设计具有强烈行动号召力的画面，配合促销信息或限时优惠，促成订单转化'
                    };

                    types.forEach(function(t, i) {
                        prompt += '> **第' + (i+1) + '/' + types.length + '张 - ' + (typeMap[t] || t) + '**\n';
                        var basePrompt = typePrompts[t] || '根据所选类型生成专业电商图片';
                        prompt += basePrompt + '。产品：' + (form.productName || '');
                        if (userExtra) prompt += '。' + userExtra;
                        prompt += '。图片比例：' + form.ratio + '。\n\n';
                    });

                    mainPromptGenerating.value = false;
                    mainGeneratedPrompt.value = prompt;
                    if (!checkAdvertisingLaw(prompt)) return;
                    Toast.success('已生成 ' + types.length + ' 张图片的提示词，请确认后生图');

                } else if (page === 'detail') {
                    form = detailForm.value;
                    types = form.imageTypes;
                    typeMap = {};
                    detailImageTypes.forEach(function(t) { typeMap[t.key] = t.name; });

                    var typeNames = types.map(function(k) { return typeMap[k] || k; }).join('、');
                    var userExtra = '';
                    if (form.sellingPoints) userExtra += form.sellingPoints + '。';

                    prompt = '【产品名称】' + (form.productName || '未填写') + '\n';
                    if (form.sellingPoints) prompt += '【产品描述】' + form.sellingPoints + '\n';
                    prompt += '\n--- AI 生成提示词（共 ' + types.length + ' 张）---\n\n';

                    var detailTypePrompts = {
                        'hero': '首屏主视觉大图：震撼的产品展示海报级画面，突出品牌调性和产品核心吸引力',
                        'selling': '核心卖点图：逐一拆解产品主要卖点，每张聚焦一个卖点，用可视化方式清晰传达',
                        'scene-usage': '使用场景图：多场景展示产品实际应用环境，让买家看到产品在生活中的样子',
                        'multi-angle': '多角度图：360度全方位展示产品外观，包含正面、侧面、背面、顶部等多视角',
                        'scene-atmosphere': '场景氛围图：配合符合产品调性的高级场景，烘托出产品的使用氛围和高级感',
                        'detail-shot': '商品细节图：高清特写展示产品工艺细节、材质纹理、按键接口等精细部位',
                        'brand-story': '品牌故事图：讲述品牌理念和发展历程的视觉化内容，建立情感连接',
                        'size-capacity': '尺寸容量尺码图：清晰直观地展示产品的实际大小、容量或对应的尺码信息',
                        'comparison': '效果对比图：与市场同类产品的客观对比，突出差异化优势和核心竞争力',
                        'spec-table': '详细规格参数表：设计精美的参数表格图，清晰列出尺寸、重量、材质、性能等关键数据',
                        'process': '工艺制作图：展示产品设计研发、生产制造、质量检测等环节，体现专业性',
                        'accessories': '配件赠品图：展示产品包装内包含的所有配件和购买赠品，丰富产品价值',
                        'series': '系列展示图：将同系列的不同颜色、款式放在一起展示，方便用户对比选择',
                        'ingredients': '商品成分图：清晰展示产品的成分配方、材质构成，增加透明度和信任感',
                        'guarantee': '售后保障图：展示退换货政策、质保期限、客服支持等售后承诺，增强购买信心',
                        'usage-advice': '使用建议图：提供产品的使用方法、注意事项、保养建议等贴心指导'
                    };

                    types.forEach(function(t, i) {
                        prompt += '> **第' + (i+1) + '/' + types.length + '张 - ' + (typeMap[t] || t) + '**\n';
                        var basePrompt = detailTypePrompts[t] || '根据所选类型生成详情页图片';
                        prompt += basePrompt + '。产品：' + (form.productName || '');
                        if (userExtra) prompt += '。' + userExtra;
                        prompt += '。图片比例：' + form.ratio + '。\n\n';
                    });

                    detailPromptGenerating.value = false;
                    detailGeneratedPrompt.value = prompt;
                    if (!checkAdvertisingLaw(prompt)) return;
                    Toast.success('已生成 ' + types.length + ' 张图片的提示词，请确认后生图');
                }
            }, 800);
        });

        const checkAdvertisingLaw = (text) => {
            if (!text) return true;
            const adWords = ['最', '第一', '首个', '唯一', '极品', '顶级', '国家级', '世界级', '全球首发', '独家', '首选', '绝对', '万能', '神效', '包治百病', '无敌', '王牌', '冠军', '巅峰', '领袖', '史无前例', '前无古人', '永久', '无药可救'];
            let foundWords = [];
            adWords.forEach(word => {
                if (text.includes(word)) {
                    foundWords.push(word);
                }
            });
            
            if (foundWords.length > 0) {
                Toast.warning(`提示：您填写的提示词中包含可能违规的广告法/敏感词 (${foundWords.join(', ')})，请注意修改以符合要求。`);
                return false;
            }
            return true;
        };

        const handleGenerate = requireLogin((page) => {
            checkMemberBeforeGenerate(() => {
                console.log('=== handleGenerate 开始 ===', 'page:', page, '时间:', new Date().toLocaleTimeString());

            var form, types, typeMap, resultArray, promptText = '';

            if (page === 'main') {
                form = mainForm.value;
                types = form.imageTypes;
                typeMap = {};
                mainImageTypes.forEach(function(t) { typeMap[t.key] = t.name; });
                resultArray = mainGeneratedImages;
                promptText = mainGeneratedPrompt.value || '';
                if (promptText && !checkAdvertisingLaw(promptText)) return;
            } else if (page === 'detail') {
                form = detailForm.value;
                types = form.imageTypes;
                typeMap = {};
                detailImageTypes.forEach(function(t) { typeMap[t.key] = t.name; });
                resultArray = detailGeneratedImages;
                promptText = detailGeneratedPrompt.value || '';
                if (promptText && !checkAdvertisingLaw(promptText)) return;
            } else if (page === 'whitebg') {
                form = whitebgForm.value;
                types = [];
                typeMap = {};
                resultArray = mainGeneratedImages;
                if (!promptText && form.prompt) {
                    promptText = form.prompt;
                }
                if (!promptText) {
                    promptText = '专业电商白底产品图，' + (form.productName || '产品') + '，纯白色背景，产品居中放置，柔和均匀的光影效果，高清细节展示，商业摄影风格，简洁大气';
                }
            } else if (page === 'clone') {
                form = cloneForm.value;
                types = [];
                typeMap = {};
                resultArray = mainGeneratedImages;
                var hasOriginalImages = cloneRefImages.value.length > 0 || form.referenceUrl;
                var hasTargetImages = cloneCloneRefImages.value.length > 0;
                if (!promptText && form.newProductInfo) {
                    promptText = form.newProductInfo;
                }
                if (!promptText) {
                    if (hasOriginalImages && hasTargetImages) {
                        promptText = 'AI智能商品替换：保持原图的场景、构图、光影和氛围不变，将原图中的商品精准替换为目标商品，确保新商品自然融入画面，尺寸比例协调，阴影透视一致，电商级高清输出';
                    } else if (hasOriginalImages) {
                        promptText = '基于原图进行商品重新渲染，优化产品展示效果，专业电商品质';
                    } else {
                        promptText = '生成高质量电商产品图';
                    }
                }
} else if (page === 'xiaohongshu') {
                handleXhsGenerate();
                return;
            } else {
                form = {};
                types = [];
                typeMap = {};
                resultArray = mainGeneratedImages;
            }

            if (!form) form = {};

            var totalImages = 1;
            var apiPrompts = [];
            var sceneList = [];

            if (types && types.length > 0) {
                totalImages = types.length;
                for (var ti = 0; ti < types.length; ti++) {
                    var typeName = typeMap[types[ti]] || ('图片' + (ti + 1));
                    var p = '请为产品「' + (form.productName || '') + '」生成一张' + typeName + '风格的电商图片';
                    if (form.sellingPoints) p += '。核心卖点：' + form.sellingPoints;
                    if (promptText) p += '。\n' + promptText;
                    if (form.ratio) p += '。图片比例：' + form.ratio;
                    apiPrompts.push({ key: types[ti], name: typeName, prompt: p });
                    sceneList.push(types[ti]);
                }
            } else {
                var pageLabels = { 'main': 'AI主图', 'detail': '详情页', 'whitebg': '白底图', 'clone': '一键仿图', 'xiaohongshu': '小红书' };
                var sp = '请为产品「' + (form.productName || '') + '」生成一张专业的' + (pageLabels[page] || page) + '电商图片';
                if (form.sellingPoints) sp += '。卖点：' + form.sellingPoints;
                if (promptText) sp += '。\n' + promptText;
                apiPrompts.push({ key: page, name: pageLabels[page] || page, prompt: sp });
                sceneList.push(page);
            }

            console.log('📤 发送参数:', { totalImages: totalImages, scenes: sceneList, product: form.productName, ratio: form.ratio });

            Toast.info('🚀 已添加 ' + totalImages + ' 张图片到生成队列（共 ' + (generatingTaskCount.value + 1) + ' 个任务）');

            generatingTaskCount.value++;
            if (generatingTaskCount.value === 1) {
                showGeneratingModal.value = true;
            }
            generatingModalInfo.value = { title: pageTitle.value + '（' + totalImages + '张）', current: 0, total: totalImages };

            var genAborted = false;
            var abortController = new AbortController();
            var genTimeoutId = null;

            function doAbort(reason) {
                if (reason === 'finish') return;
                genAborted = true;
                try { abortController.abort(); } catch(e) {}
                if (genTimeoutId) { clearTimeout(genTimeoutId); genTimeoutId = null; }
            }

            function finishGeneration() {
                isGeneratingLock = false;
                doAbort('finish');
                generatingTaskCount.value--;
                if (generatingTaskCount.value <= 0) {
                    generatingTaskCount.value = 0;
                    setTimeout(function() { showGeneratingModal.value = false; }, 500);
                    mainGeneratedPrompt.value = '';
                    detailGeneratedPrompt.value = '';
                }
            }

            function callAPI(index) {
                if (genAborted || index >= totalImages) {
                    finishGeneration();
                    if (!genAborted && index >= totalImages) {
                        Toast.success('生成完成！共 ' + resultArray.value.length + ' 张图片');
                        saveHistory(page, resultArray.value, form);
                        // 生成完成后刷新算力显示
                        setTimeout(function() { loadMemberInfo(); }, 500);
                    }
                    return;
                }

                generatingModalInfo.value.current = index + 1;
                var item = apiPrompts[index];
                console.log('--- 开始第', index + 1, '张:', item.name, '---');

                var formData = new FormData();
                formData.append('prompt', item.prompt);
                formData.append('image_type', page);
                formData.append('scene_key', item.key);
                formData.append('scene_name', item.name);
                formData.append('ratio', form.ratio || '1:1');
                formData.append('platform', 'taobao');

                // 参考图 - 所有页面都支持
                var refBase64 = '';
                var refImageCount = 0;
                if (page === 'main' && mainRefImages.value.length > 0) {
                    refImageCount = mainRefImages.value.length;
                    if (mainRefImages.value[0] && mainRefImages.value[0].indexOf('data:image') === 0) refBase64 = mainRefImages.value[0];
                } else if (page === 'detail' && detailRefImages.value.length > 0) {
                    refImageCount = detailRefImages.value.length;
                    if (detailRefImages.value[0] && detailRefImages.value[0].indexOf('data:image') === 0) refBase64 = detailRefImages.value[0];
                } else if (page === 'whitebg' && whitebgRefImages.value.length > 0) {
                    refImageCount = whitebgRefImages.value.length;
                    if (whitebgRefImages.value[0] && whitebgRefImages.value[0].indexOf('data:image') === 0) refBase64 = whitebgRefImages.value[0];
                } else if (page === 'clone' && cloneRefImages.value.length > 0) {
                    refImageCount = cloneRefImages.value.length;
                    if (cloneRefImages.value[0] && cloneRefImages.value[0].indexOf('data:image') === 0) refBase64 = cloneRefImages.value[0];
                }
                console.log('🖼️ 参考图: count=' + refImageCount + ', hasBase64=' + !!refBase64 + ', b64Len=' + (refBase64 ? refBase64.length : 0));
                if (refBase64) {
                    formData.append('has_ref_image', '1');
                    formData.append('ref_image_base64', refBase64);
                }
                // 一键仿图：添加目标商品图
                if (page === 'clone' && cloneCloneRefImages.value.length > 0) {
                    var targetBase64 = cloneCloneRefImages.value[0];
                    if (targetBase64 && targetBase64.indexOf('data:image') === 0) {
                        formData.append('has_target_image', '1');
                        formData.append('target_image_base64', targetBase64);
                        console.log('🎯 目标商品图已添加, b64Len=' + targetBase64.length);
                    }
                }

                // 60秒超时保护
                if (genTimeoutId) { clearTimeout(genTimeoutId); genTimeoutId = null; }
                genTimeoutId = setTimeout(function() {
                    console.warn('⚠️ 第' + (index+1) + '张请求超时(60s)，自动跳过');
                    doAbort('timeout');
                }, 60000);

                var token = localStorage.getItem('tianle_token') || localStorage.getItem('ai_token') || '';
                var genHeaders = {};
                if (token) genHeaders['Authorization'] = 'Bearer ' + token;

                fetch(getApiUrl('/v1/ai-agent/generate'), {
                    method: 'POST',
                    headers: genHeaders,
                    body: formData,
                    signal: abortController.signal
                })
                .then(function(res) {
                    console.log('📥 HTTP:', res.status, res.statusText);
                    if (!res.ok) {
                        return res.text().then(function(text) {
                            var errData;
                            try { errData = JSON.parse(text); } catch(e) { errData = null; }
                            var detail = '';
                            if (errData && errData.data && errData.data.error) detail = errData.data.error;
                            else if (errData && errData.message) detail = errData.message;
                            throw new Error('API ' + res.status + (detail ? ': ' + detail : ''));
                        });
                    }
                    return res.text();
                })
                .then(function(rawText) {
                    console.log('📋 响应(前300字):', rawText.substring(0, 300));
                    var data;
                    try { data = JSON.parse(rawText); } catch(e) { throw new Error('非JSON: ' + rawText.substring(0, 100)); }
                    console.log('✅ 解析后:', data);

                    var gotImage = false;

                    // 格式1: 后端 { code:200, data:{ images:[{url:...}] } }
                    if ((data.code === 200 || data.code === 1) && data.data && Array.isArray(data.data.images)) {
                        data.data.images.forEach(function(imgObj) {
                            var url = imgObj.url || imgObj.b64_json || imgObj.image_url || imgObj.image || '';
                            if (typeof imgObj === 'string') url = imgObj;
                            if (url) { resultArray.value.push(url); gotImage = true; console.log('   🖼️ URL:', url.substring(0, 60)); }
                        });
                    }
                    // 格式2: 参考系统 { code:1, data:{ image_url: "..." } }
                    else if ((data.code === 200 || data.code === 1) && data.data && (data.data.image_url || data.data.url)) {
                        var urls = Array.isArray(data.data.image_url || data.data.url) ? (data.data.image_url || data.data.url) : [data.data.image_url || data.data.url];
                        urls.forEach(function(u) { if (u) { resultArray.value.push(u); gotImage = true; } });
                    }

                    if (gotImage) {
                        Toast.success('第' + (index+1) + '张「' + item.name + '」✅');
                        if (typeof loadMemberInfo === 'function') loadMemberInfo();
                    } else {
                        var errMsg = (data.message || data.msg || data.error || JSON.stringify(data).substring(0, 80));
                        console.warn('⚠️ 第' + (index+1) + '张无图片:', errMsg);
                        Toast.warning('第' + (index+1) + '张⚠️ ' + errMsg.substring(0, 30));
                        resultArray.value.push(createPlaceholderImg(item.name, form, errMsg));
                    }

                    callAPI(index + 1);
                })
                .catch(function(err) {
                    if (err.name === 'AbortError') {
                        console.log('⏹️ 第' + (index+1) + '张已取消');
                        callAPI(index + 1);
                        return;
                    }
                    console.error('❌ 第' + (index+1) + '张异常:', err.message);
                    Toast.error('第' + (index+1) + '张🔥 ' + err.message);
                    resultArray.value.push(createPlaceholderImg(item.name, form, err.message));
                    callAPI(index + 1);
                });
            }

            function createPlaceholderImg(name, f, errLabel) {
                var colors = ['#667eea','#764ba2','#f093fb','#f5576c','#4facfe','#00f2fe','#43e97b','#38f9d7','#fa709a'];
                var c = colors[Math.floor(Math.random() * colors.length)];
                var label = errLabel ? ('错误: ' + errLabel) : 'API调用失败';
                var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="pg' + Date.now() + '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:'+c+';stop-opacity:0.9"/><stop offset="100%" style="stop-color:'+c+';stop-opacity:0.6"/></linearGradient></defs><rect fill="url(#pg' + Date.now() + ')" width="400" height="400" rx="12"/><text x="50%" y="42%" fill="#fff" font-size="15" font-weight="bold" text-anchor="middle" dy=".3em">'+name+'</text><text x="50%" y="56%" fill="rgba(255,255,255,0.7)" font-size="11" text-anchor="middle" dy=".3em">'+(f?f.productName:'')+'</text><text x="50%" y="68%" fill="rgba(255,255,255,0.5)" font-size="10" text-anchor="middle" dy=".3em">'+label+'</text></svg>';
                return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
            }

            callAPI(0);
          });
      });

      const handleLogin = () => {
        if (!loginForm.value.username || !loginForm.value.password) {
            Toast.error('请输入用户名和密码');
            return;
        }

        loginLoading.value = true;
        Toast.info('正在登录...');

        var formData = new FormData();
        formData.append('username', loginForm.value.username);
        formData.append('password', loginForm.value.password);

        fetch(getAuthUrl('login'), {
            method: 'POST',
            body: formData
        })
        .then(function(res) { return res.text(); })
        .then(function(rawText) {
            try {
                var data = JSON.parse(rawText);
                if (data.code === 200 && data.data) {
                    isLoggedIn.value = true;
                    showLoginDialog.value = false;
                    localStorage.setItem('tianle_loggedIn', 'true');
                    if (data.data.token) localStorage.setItem('tianle_token', data.data.token);
                    if (data.data.user) localStorage.setItem('tianle_user', JSON.stringify(data.data.user));
                    Toast.success('登录成功！欢迎回来 👋');
                    loadMemberInfo();
                } else {
                    Toast.error(data.message || '登录失败，请检查用户名和密码');
                }
            } catch(e) {
                console.warn('登录响应解析失败:', e.message);
                Toast.error('登录响应异常，请重试');
            }
            loginLoading.value = false;
            loginForm.value.username = '';
            loginForm.value.password = '';
        })
        .catch(function(err) {
            console.warn('登录请求失败:', err.message);
            loginLoading.value = false;
            Toast.error('网络请求失败，请检查网络连接');
            loginForm.value.username = '';
            loginForm.value.password = '';
        });
    };

    const handleRegister = () => {
        if (!regForm.value.username || regForm.value.username.length < 2) { Toast.error('用户名至少2个字符'); return; }
        if (!regForm.value.phone || !/^1[3-9]\d{9}$/.test(regForm.value.phone)) { Toast.error('请输入正确的手机号'); return; }
        if (!regForm.value.password || regForm.value.password.length < 6) { Toast.error('密码至少6位'); return; }
        if (regForm.value.password !== regForm.value.password2) { Toast.error('两次密码不一致'); return; }
        regLoading.value = true;
        var formData = new FormData();
        formData.append('username', regForm.value.username);
        formData.append('phone', regForm.value.phone);
        formData.append('password', regForm.value.password);
        if (regForm.value.invite_code) formData.append('invite_code', regForm.value.invite_code);
        fetch(getAuthUrl('register'), { method: 'POST', body: formData })
            .then(function(r) { return r.text(); })
            .then(function(rawText) {
                var data = JSON.parse(rawText);
                if (data.code === 200 && data.data && data.data.token) {
                    isLoggedIn.value = true;
                    showLoginDialog.value = false;
                    localStorage.setItem('tianle_loggedIn', 'true');
                    if (data.data.token) localStorage.setItem('tianle_token', data.data.token);
                    if (data.data.user) localStorage.setItem('tianle_user', JSON.stringify(data.data.user));
                    Toast.success('🎉 注册成功！欢迎加入天乐AI');
                    loadMemberInfo();
                } else {
                    Toast.error(data.message || '注册失败');
                }
                regLoading.value = false;
                regForm.value = { username: '', phone: '', password: '', password2: '', invite_code: '' };
            })
            .catch(function(err) {
                regLoading.value = false;
                Toast.error('注册请求失败: ' + err.message);
            });
    };

    const logout = () => {
        isLoggedIn.value = false;
        localStorage.removeItem('tianle_loggedIn');
        localStorage.removeItem('tianle_token');
        localStorage.removeItem('tianle_user');
        memberInfo.value = { is_vip: false, vip_expire: '', credits: 0, total_credits: 0, packages: [], settings: {} };
        Toast.info('已退出登录');
    };

    // ========== 域名授权检查 ==========
    const checkDomainAuth = () => {
        fetch(getApiUrl('/v1/domain-auth/check'))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                domainAuthChecked.value = true;
                if (data.code === 200) {
                    domainAuthBlocked.value = !data.authorized;
                    if (!data.authorized) {
                        console.warn('⚠️ 域名未授权:', currentDomain.value);
                    }
                } else {
                    domainAuthBlocked.value = false;
                }
            })
            .catch(function(err) {
                console.warn('域名授权检查失败，允许访问:', err.message);
                domainAuthChecked.value = true;
                domainAuthBlocked.value = false;
            });
    };

    // ========== 站点信息加载 ==========
    const loadSiteInfo = () => {
        fetch(getApiUrl('/v1/site/info'))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.code === 200 && data.data) {
                    siteInfo.value = {
                        is_substation: !!data.data.is_substation,
                        domain: data.data.domain || '',
                        name: data.data.name || '',
                        settings: data.data.settings || {},
                        packages: Array.isArray(data.data.packages) && data.data.packages.length > 0 ? data.data.packages : [{ id:1, name:'月度VIP', days:30, price:29.9, credits:500, badge:'热门' }, { id:2, name:'季度VIP', days:90, price:79.9, credits:2000, badge:'超值' }, { id:3, name:'年度VIP', days:365, price:249.9, credits:10000, badge:'推荐' }],
                        payment_enabled: !!data.data.payment_enabled,
                        wechat_login_enabled: !!data.data.wechat_login_enabled
                    };
                    console.log('📡 站点信息:', siteInfo.value.is_substation ? ('分站: ' + siteInfo.value.name) : '主站');
                }
            })
            .catch(function(err) { console.warn('站点信息加载失败:', err.message); });
    };

    // ========== 微信登录 ==========
    
    let wxLoginTimer = null;
    const showWechatLogin = () => {
        wxLoggingIn.value = true;
        fetch(getApiUrl('/v1/auth/wechat-login-qrcode'), { method: 'POST' })
            .then(res => res.json())
            .then(res => {
                if (res.code === 200 && res.data) {
                    const qrHtml = `
                        <div style="text-align:center; padding:20px;">
                            <h3>微信扫码登录</h3>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(res.data.qrcode_url)}" style="width:200px;height:200px;margin:20px auto;">
                            <p>请使用微信扫描上方二维码</p>
                            <button class="btn-secondary" style="margin-top:15px;padding:8px 16px;border-radius:8px;" onclick="document.getElementById('wechat-qrcode-container').style.display='none';document.getElementById('login-form-inner').style.display='block';">返回账号登录</button>
                        </div>
                    `;
                    
                    const loginInner = document.querySelector('.login-form').children[0];
                    loginInner.id = 'login-form-inner';
                    loginInner.style.display = 'none';
                    
                    let wxContainer = document.getElementById('wechat-qrcode-container');
                    if (!wxContainer) {
                        wxContainer = document.createElement('div');
                        wxContainer.id = 'wechat-qrcode-container';
                        document.querySelector('.login-form').appendChild(wxContainer);
                    }
                    wxContainer.innerHTML = qrHtml;
                    wxContainer.style.display = 'block';
                    
                    if (wxLoginTimer) clearInterval(wxLoginTimer);
                    wxLoginTimer = setInterval(() => {
                        fetch(getApiUrl('/v1/auth/wechat-login-check'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ scene_id: res.data.scene_id })
                        }).then(r => r.json()).then(r => {
                            if (r.code === 200) {
                                clearInterval(wxLoginTimer);
                                localStorage.setItem('tianle_token', r.data.token);
                                localStorage.setItem('tianle_user', JSON.stringify(r.data.user));
                                localStorage.setItem('tianle_loggedIn', 'true');
                                Toast.success('登录成功');
                                isLoggedIn.value = true;
                                showLoginDialog.value = false;
                                wxLoggingIn.value = false;
                                loadUserInfo();
                                document.getElementById('wechat-qrcode-container').style.display = 'none';
                                document.getElementById('login-form-inner').style.display = 'block';
                            } else if (r.code !== 202) {
                                clearInterval(wxLoginTimer);
                                Toast.error(r.message || '二维码失效，请刷新');
                                wxLoggingIn.value = false;
                            }
                        });
                    }, 3000);
                } else {
                    Toast.error(res.message || '获取微信登录二维码失败');
                    wxLoggingIn.value = false;
                }
            });
    };

    const handleWeChatLogin = () => { showWechatLogin(); };


    // ========== 充值支付 ==========
    const openRecharge = () => {
        if (!isLoggedIn.value) { showLoginDialog.value = true; return; }
        selectedPackage.value = null;
        payQrCode.value = '';
        paying.value = false;
        orderPrice.value = 0;
        payStatusText.value = '等待支付...';
        payStatusClass.value = '';
        if (payPollTimer) { clearInterval(payPollTimer); payPollTimer = null; }
        showRechargeModal.value = true;
    };

    const handleCreateOrder = () => {
        if (!selectedPackage.value) { Toast.error('请选择套餐'); return; }
        orderCreating.value = true;
        var token = localStorage.getItem('tianle_token') || '';
        fetch(getApiUrl('/v1/payment/create-order'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ package_id: selectedPackage.value, pay_type: payMethod.value })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            orderCreating.value = false;
            if (data.code === 200 && data.data) {
                currentOrderId.value = data.data.order_id;
                orderPrice.value = data.data.price;
                paying.value = true;
                fetchPaymentQR(currentOrderId.value);
            } else {
                Toast.error(data.message || '创建订单失败');
            }
        })
        .catch(function(err) {
            orderCreating.value = false;
            Toast.error('创建订单失败: ' + err.message);
        });
    };

    const fetchPaymentQR = (orderId) => {
        fetch(getApiUrl('/v1/payment/qrcode/') + orderId)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.code === 200 && data.data) {
                    payQrCode.value = data.data.qr_code;
                    startPolling(orderId);
                } else {
                    Toast.error(data.message || '获取支付二维码失败');
                    cancelPayment();
                }
            })
            .catch(function(err) {
                Toast.error('获取二维码失败: ' + err.message);
                cancelPayment();
            });
    };

    const startPolling = (orderId) => {
        if (payPollTimer) { clearInterval(payPollTimer); payPollTimer = null; }
        payPollTimer = setInterval(function() {
            fetch(getApiUrl('/v1/payment/status/') + orderId)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.code === 200 && data.data) {
                        var status = data.data.status;
                        if (status === 'paid') {
                            clearInterval(payPollTimer);
                            payPollTimer = null;
                            paying.value = false;
                            payStatusText.value = '支付成功！';
                            payStatusClass.value = 'success';
                            Toast.success('充值成功！');
                            setTimeout(function() { showRechargeModal.value = false; }, 1500);
                            loadMemberInfo();
                        } else if (status === 'expired' || status === 'closed') {
                            cancelPayment();
                        }
                    }
                })
                .catch(function(err) {
                    console.warn('轮询支付状态失败:', err.message);
                });
        }, 3000);
    };

    const cancelPayment = () => {
        if (payPollTimer) { clearInterval(payPollTimer); payPollTimer = null; }
        paying.value = false;
        payQrCode.value = '';
        payStatusText.value = '已取消';
        payStatusClass.value = '';
    };

    // ========== 会员信息加载 ==========
    const loadMemberInfo = () => {
        var token = localStorage.getItem('tianle_token') || '';
        if (!token) return;
        
        fetch(getApiUrl('/v1/member/info'), {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.code === 200 && data.data) {
                memberInfo.value = data.data;
                if (data.data.is_vip) {
                    memberInfo.value.vip_expire = data.data.vip_expire || '';
                }
            }
        })
        .catch(function(err) {
            console.warn('加载会员信息失败:', err.message);
        });
    };

    const loadUserInfo = loadMemberInfo;

    // ========== VIP购买 ==========
    const openVipModal = () => {
        if (!isLoggedIn.value) { showLoginDialog.value = true; return; }
        selectedVipPackage.value = null;
        vipPayQrCode.value = '';
        vipPaying.value = false;
        vipPayStatusText.value = '等待支付...';
        if (vipPollTimer) { clearInterval(vipPollTimer); vipPollTimer = null; }
        showVipModal.value = true;
    };

    const loadCreditPackages = () => {
        creditPackages.value = creditsPackages.value;
    };

    const handleBuyCredit = () => {
        if (!selectedCreditPackage.value && !customCreditsAmount.value) {
            Toast.error('请选择套餐或输入自定义数量');
            return;
        }
        creditOrderCreating.value = true;
        var token = localStorage.getItem('tianle_token') || '';
        var buyData = {
            type: 'credit',
            credits: selectedCreditPackage.value ? creditPackages.value[selectedCreditPackage.value].credits : parseInt(customCreditsAmount.value),
            amount: selectedCreditPackage.value ? creditPackages.value[selectedCreditPackage.value].price : customCreditsPrice.value
        };
        fetch(getApiUrl('/v1/payment/create-order'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(buyData)
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            creditOrderCreating.value = false;
            if (data.code === 200 && data.data) {
                currentOrderId.value = data.data.order_id;
                creditPaying.value = true;
                fetchVipQR(currentOrderId.value);
            } else {
                Toast.error(data.message || '创建订单失败');
            }
        })
        .catch(function(err) {
            creditOrderCreating.value = false;
            Toast.error('创建订单失败: ' + err.message);
        });
    };

    const fetchVipQR = (orderId) => {
        fetch(getApiUrl('/v1/payment/qrcode/') + orderId)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.code === 200 && data.data) {
                    vipPayQrCode.value = data.data.qr_code;
                    startVipPolling(orderId);
                } else {
                    Toast.error(data.message || '获取支付二维码失败');
                    cancelVipPayment();
                }
            })
            .catch(function(err) {
                Toast.error('获取二维码失败: ' + err.message);
                cancelVipPayment();
            });
    };

    const startVipPolling = (orderId) => {
        if (vipPollTimer) { clearInterval(vipPollTimer); vipPollTimer = null; }
        vipPollTimer = setInterval(function() {
            fetch(getApiUrl('/v1/payment/status/') + orderId)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.code === 200 && data.data) {
                        var status = data.data.status;
                        if (status === 'paid') {
                            clearInterval(vipPollTimer);
                            vipPollTimer = null;
                            vipPaying.value = false;
                            vipPayStatusText.value = '支付成功！';
                            Toast.success('购买成功！');
                            setTimeout(function() { showVipModal.value = false; }, 1500);
                            loadMemberInfo();
                        } else if (status === 'expired' || status === 'closed') {
                            cancelVipPayment();
                        }
                    }
                })
                .catch(function(err) {
                    console.warn('轮询VIP支付状态失败:', err.message);
                });
        }, 3000);
    };

    const openCreditsModal = () => {
        if (!isLoggedIn.value) { showLoginDialog.value = true; return; }
        selectedCreditsPkg.value = 0;
        customCreditsAmount.value = '';
        creditsBuying.value = false;
        showCreditsModal.value = true;
        loadCreditPackages();
    };

    const handleBuyCredits = async () => {
        var amount = parseInt(customCreditsAmount.value) || 0;
        if (amount < 10) { Toast.error('最少购买10个算力'); return; }
        creditsBuying.value = true;
        var token = localStorage.getItem('tianle_token') || '';
        try {
            var res = await fetch(getApiUrl('/v1/payment/create-order'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ type: 'credit', credits: amount, amount: amount * 0.06 })
            });
            var data = await res.json();
            creditsBuying.value = false;
            if (data.code === 200 && data.data) {
                currentOrderId.value = data.data.order_id;
                vipPayQrCode.value = ''; // 复用VIP二维码变量
                startVipPolling(data.data.order_id);
                Toast.info('订单已创建，请扫码支付');
            } else {
                Toast.error(data.message || '创建订单失败');
            }
        } catch(e) {
            creditsBuying.value = false;
            Toast.error('网络错误');
        }
    };

const cancelVipPayment = () => {
        if (vipPollTimer) { clearInterval(vipPollTimer); vipPollTimer = null; }
        vipPaying.value = false;
        creditPaying.value = false;
        vipPayQrCode.value = '';
        vipPayStatusText.value = '已取消';
    };

    // ========== 会员等级检查 ==========
    const checkMemberBeforeGenerate = (callback) => {
        var token = localStorage.getItem('tianle_token') || '';
        if (!token) {
            showLoginDialog.value = true;
            return;
        }
        
        fetch(getApiUrl('/v1/member/info'), {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.code === 200 && data.data) {
                memberInfo.value = data.data;
                var credits = data.data.credits || 0;
                if (credits <= 0) {
                    Toast.warning('算力不足，请先充值');
                    openRecharge();
                    return;
                }
                callback();
            } else {
                Toast.error('获取会员信息失败');
            }
        })
        .catch(function(err) {
            console.warn('检查会员状态失败:', err.message);
            callback(); // 即使检查失败也允许继续
        });
    };

    // ========== 历史记录管理 ==========
    const saveHistory = (page, images, form) => {
        try {
            // 清理图片数据，只保留URL，不保留base64，避免超出localStorage配额
            var cleanImages = function(images) {
                if (!Array.isArray(images)) return images;
                return images.map(function(img) {
                    if (typeof img === 'string') return img;
                    var clean = {};
                    for (var k in img) {
                        if (k === 'data' || k === 'base64' || k === 'blob') continue;
                        clean[k] = img[k];
                    }
                    return clean;
                });
            };
            var record = {
                id: Date.now(),
                page: page,
                time: new Date().toLocaleString(),
                images: cleanImages(images).slice(0, 10),
                form: form ? { productName: form.productName, ratio: form.ratio } : {}
            };
            historyRecords.value.unshift(record);
            if (historyRecords.value.length > 30) historyRecords.value = historyRecords.value.slice(0, 30);
            var jsonStr = JSON.stringify(historyRecords.value);
            // 如果超过3MB，清理图片后重试
            if (jsonStr.length > 3 * 1024 * 1024) {
                console.warn('[History] 数据超过3MB，清理图片数据');
                historyRecords.value = historyRecords.value.map(function(r) {
                    r.images = [];
                    return r;
                });
                jsonStr = JSON.stringify(historyRecords.value);
            }
            localStorage.setItem('tianle_history', jsonStr);
        } catch(e) {
            console.warn('保存历史记录失败:', e);
            // 如果quota超限，只保留空图片的记录
            if (e.name === 'QuotaExceededError' || (e.message && e.message.indexOf('quota') !== -1)) {
                try {
                    var minimal = historyRecords.value.map(function(r) {
                        return { id: r.id, page: r.page, time: r.time, images: [], form: r.form };
                    }).slice(0, 10);
                    localStorage.setItem('tianle_history', JSON.stringify(minimal));
                } catch(e2) {
                    console.error('[History] 清理后仍然存储失败:', e2);
                }
            }
        }
    };

    const deleteHistoryRecord = (id) => {
        var idx = historyRecords.value.findIndex(r => r.id === id);
        if (idx > -1) {
            historyRecords.value.splice(idx, 1);
            localStorage.setItem('tianle_history', JSON.stringify(historyRecords.value));
            Toast.success('记录已删除');
        }
    };

    const clearHistory = () => {
        if (confirm('确定要清空所有历史记录吗？')) {
            historyRecords.value = [];
            localStorage.removeItem('tianle_history');
            Toast.success('历史记录已清空');
        }
    };

    // ========== 生成控制 ==========
    const cancelGeneration = () => {
        isGeneratingLock = false;
        generatingTaskCount.value = 0;
        showGeneratingModal.value = false;
        mainGeneratedPrompt.value = '';
        detailGeneratedPrompt.value = '';
        Toast.info('已取消生成');
    };

    // ========== 灯箱查看器 ==========
    function openLightbox(img, idx, list, title, page) {
        lightboxImg.value = img;
        lightboxIdx.value = idx || 0;
        lightboxImageList = list || [img];
        lightboxTotal.value = lightboxImageList.length;
        lightboxShow.value = true;
    }

    function closeLightbox() {
        lightboxShow.value = false;
        lightboxImg.value = '';
        lightboxIdx.value = 0;
        lightboxTotal.value = 0;
        lightboxImageList = [];
    }

    function prevLightbox() { 
        if (lightboxIdx.value > 0) { 
            lightboxIdx.value--; 
            lightboxImg.value = lightboxImageList[lightboxIdx.value]; 
        } 
    }

    function nextLightbox() { 
        if (lightboxIdx.value < lightboxTotal.value - 1) { 
            lightboxIdx.value++; 
            lightboxImg.value = lightboxImageList[lightboxIdx.value]; 
        } 
    }

    // ========== 图片下载功能 ==========
    function downloadSingleImage(imgUrl) {
        if (!imgUrl) return;
        var a = document.createElement('a');
        a.href = imgUrl;
        a.download = 'tianle_ai_' + Date.now() + '.png';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        Toast.success('开始下载');
    }

    async function downloadAllSingle(page) {
        var images = page === 'main' ? mainGeneratedImages.value : detailGeneratedImages.value;
        if (images.length === 0) { Toast.warning('暂无图片可下载'); return; }
        Toast.info('开始下载 ' + images.length + ' 张图片...');
        for (var i = 0; i < images.length; i++) {
            downloadSingleImage(images[i]);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        Toast.success('全部下载完成');
    }

    async function downloadLongImage(page) {
        var images = page === 'main' ? mainGeneratedImages.value : detailGeneratedImages.value;
        if (images.length === 0) { Toast.warning('暂无图片可下载'); return; }
        
        Toast.loading('正在生成长图...');
        
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var imgWidth = 800;
        var imgHeight = 800;
        var padding = 20;
        var gap = 20;
        canvas.width = imgWidth;
        canvas.height = (imgHeight + gap) * images.length + padding * 2;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        var loadedCount = 0;
        for (var i = 0; i < images.length; i++) {
            try {
                var img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = images[i];
                });
                ctx.drawImage(img, padding, padding + i * (imgHeight + gap), imgWidth - padding * 2, imgHeight);
                loadedCount++;
            } catch(e) {
                console.warn('图片加载失败:', images[i]);
            }
        }
        
        if (loadedCount > 0) {
            var url = canvas.toDataURL('image/png');
            var a = document.createElement('a');
            a.href = url;
            a.download = 'tianle_ai_long_' + Date.now() + '.png';
            a.click();
            Toast.success('长图下载完成');
        } else {
            Toast.error('长图生成失败');
        }
    }

    function roundRect(ctx, x, y, w, h, r, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    }

    // ========== 编辑面板 ==========
    function openEditPanel(img, idx, page) {
        editTargetImg.value = img;
        editPromptText.value = '';
        editReconstructing.value = false;
        editPanelShow.value = true;
    }

    function closeEditPanel() {
        editPanelShow.value = false;
        editTargetImg.value = '';
        editPromptText.value = '';
        editReconstructing.value = false;
    }

    function doReconstruct() {
        if (!editPromptText.value.trim()) {
            Toast.warning('请输入修改描述');
            return;
        }
        editReconstructing.value = true;
        
        var token = localStorage.getItem('tianle_token') || '';
        var formData = new FormData();
        formData.append('type', 'edit');
        formData.append('has_ref_image', '1');
        formData.append('ref_image_base64', editTargetImg.value);
        formData.append('user_prompt', editPromptText.value);
        
        const headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;
        
        fetch(getApiUrl('/v1/ai-agent/edit'), {
            method: 'POST',
            headers: headers,
            body: formData
        })
        .then(res => res.json())
        .then(res => {
            editReconstructing.value = false;
            if (res.code === 200 && res.data && res.data.images && res.data.images.length > 0) {
                editTargetImg.value = res.data.images[0].url;
                Toast.success('修改成功！');
            } else {
                Toast.error(res.message || '修改失败');
            }
        })
        .catch(err => {
            editReconstructing.value = false;
            console.error('Edit error:', err);
            Toast.error('修改失败');
        });
    }

    // ========== 本地存储 ==========
    const saveToStorage = () => {
        try {
            var data = {
                mainImages: mainGeneratedImages.value,
                detailImages: detailGeneratedImages.value,
                timestamp: Date.now()
            };
            localStorage.setItem('tianle_workspace', JSON.stringify(data));
        } catch(e) {
            console.warn('保存工作区失败:', e);
        }
    };

    const loadFromStorage = () => {
        try {
            var data = JSON.parse(localStorage.getItem('tianle_workspace'));
            if (data) {
                if (data.mainImages) mainGeneratedImages.value = data.mainImages;
                if (data.detailImages) detailGeneratedImages.value = data.detailImages;
                Toast.success('已恢复上次的工作区');
            }
        } catch(e) {
            console.warn('加载工作区失败:', e);
        }
    };

    // ========== 作品集 ==========
    const viewPortfolio = (pc) => {
        currentPortfolioItem.value = pc;
        showPortfolioModal.value = true;
    };

    const fetchPortfolio = async () => {
        var token = localStorage.getItem('tianle_token') || '';
        if (!token) return;
        try {
            var res = await fetch(getApiUrl('/v1/portfolio/list'), {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            var data = await res.json();
            if (data.code === 200 && data.data) {
                portfolioItems.value = data.data;
            }
        } catch(e) {
            console.warn('加载作品集失败:', e);
        }
    };

    // ========== 分销中心 ==========
    const loadReferralInfo = async () => {
        var token = localStorage.getItem('tianle_token') || '';
        if (!token) return;
        try {
            var res = await fetch(getApiUrl('/v1/referral/stats'), {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            var data = await res.json();
            if (data.code === 200 && data.data) {
                referralStats.total_commission = data.data.total_commission || 0;
                referralStats.pending_settlement = data.data.pending_settlement || 0;
                referralStats.withdrawn = data.data.withdrawn || 0;
                referralStats.team_count = data.data.team_count || 0;
                inviteLink.value = data.data.invite_link || '';
            }
        } catch(e) {
            console.warn('加载分销信息失败:', e);
        }
    };

    const loadReferralCommissions = async (page) => {
        var token = localStorage.getItem('tianle_token') || '';
        if (!token) return;
        try {
            var res = await fetch(getApiUrl('/v1/referral/commissions?page=' + (page || 1)), {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            var data = await res.json();
            if (data.code === 200 && data.data) {
                if (page === 1) referralList.value = data.data.list || [];
                else referralList.value = referralList.value.concat(data.data.list || []);
            }
        } catch(e) {
            console.warn('加载佣金记录失败:', e);
        }
    };

    const loadMoreCommissions = () => { loadReferralCommissions(refCommPage.value + 1); };

    const copyInviteLink = () => {
        if (inviteLink.value) {
            copyToClipboard(inviteLink.value);
        } else {
            Toast.warning('邀请链接尚未生成');
        }
    };

    const drawPoster = () => {
        var canvas = document.createElement('canvas');
        canvas.width = 750;
        canvas.height = 1334;
        var ctx = canvas.getContext('2d');
        
        // 背景渐变
        var grad = ctx.createLinearGradient(0, 0, 750, 1334);
        grad.addColorStop(0, '#667eea');
        grad.addColorStop(1, '#764ba2');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 750, 1334);
        
        // 白色卡片
        roundRect(ctx, 40, 200, 670, 900, 20, '#ffffff', '');
        
        // 标题
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 36px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText('天乐AI · 邀请好友', 375, 280);
        
        // 二维码占位
        ctx.fillStyle = '#f0f0f0';
        roundRect(ctx, 275, 350, 200, 200, 10, '#f0f0f0', '');
        ctx.fillStyle = '#999999';
        ctx.font = '24px Microsoft YaHei';
        ctx.fillText('二维码', 375, 460);
        
        // 说明文字
        ctx.fillStyle = '#666666';
        ctx.font = '24px Microsoft YaHei';
        ctx.fillText('扫码注册即享福利', 375, 620);
        ctx.fillText('双方均可获得奖励', 375, 660);
        
        // 底部信息
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '22px Microsoft YaHei';
        ctx.fillText('Powered by 天乐AI', 375, 1200);
        
        posterCanvasUrl.value = canvas.toDataURL('image/png');
    };

    const downloadPoster = () => {
        if (!posterCanvasUrl.value) {
            drawPoster();
        }
        var a = document.createElement('a');
        a.href = posterCanvasUrl.value;
        a.download = 'tianle_invite_poster_' + Date.now() + '.png';
        a.click();
        Toast.success('海报下载成功');
    };

    // ========== 提现功能 ==========
    const submitWithdraw = async () => {
        if (!withdrawForm.amount || parseFloat(withdrawForm.amount) <= 0) {
            Toast.error('请输入提现金额');
            return;
        }
        if (!withdrawForm.accountName || !withdrawForm.accountNumber) {
            Toast.error('请填写完整账户信息');
            return;
        }
        
        var token = localStorage.getItem('tianle_token') || '';
        try {
            var res = await fetch(getApiUrl('/v1/referral/withdraw'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify(withdrawForm)
            });
            var data = await res.json();
            if (data.code === 200) {
                Toast.success('提现申请已提交');
                showWithdrawDialog.value = false;
                withdrawForm = { amount: '', method: 'wechat', accountName: '', accountNumber: '' };
                loadReferralInfo();
            } else {
                Toast.error(data.message || '提现申请失败');
            }
        } catch(e) {
            Toast.error('网络错误');
        }
    };

    // ========== 会话状态检查 ==========
    const checkSessionStatus = () => {
        var token = localStorage.getItem('tianle_token');
        if (!token) return;
        
        fetch(getApiUrl('/v1/auth/check'), {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.code !== 200) {
                isLoggedIn.value = false;
                localStorage.removeItem('tianle_token');
                localStorage.removeItem('tianle_loggedIn');
                localStorage.removeItem('tianle_user');
                Toast.warning('登录已过期，请重新登录');
            }
        })
        .catch(function(err) {
            console.warn('会话检查失败:', err.message);
        });
    };

        // Vue应用创建与挂载
        const app = createApp({
            setup() {
                // 返回所有响应式数据和方法
                return {
                    // 导航和页面
                    currentNav, pageTitle, pageDesc, ecommerceExpanded,
                    ecommerceItems, otherNavItems, ratios,
                    getNavIcon, switchNav, toggleImageType,
                    
                    // 认证
                    isLoggedIn, showLoginDialog, loginLoading, loginTab,
                    loginForm, regForm, regLoading,
                    handleLogin, handleRegister, logout, requireLogin,
                    
                    // 微信登录
                    wxLoggingIn, handleWeChatLogin,
                    
                    // 表单数据
                    mainForm, detailForm, whitebgForm, cloneForm, xhsForm,
                    mainImageTypes, detailImageTypes,
                    
                    // 参考图
                    mainRefImages, detailRefImages, whitebgRefImages,
                    cloneRefImages, cloneCloneRefImages, xhsRefImages, freeRefImages,
                    handleRefImageUpload, removeRefImage, removeXhsRef,
                    handleFreeUpload, handleTryonGarmentUpload, handleTryonModelUpload,
                    handleTranslateUpload,
                    
                    // 小红书
                    xhsGenerating, xhsGenStep, xhsDetectedProduct, xhsResult,
                    xhsGeneratedImages, detectProductFromImage,
                    handleXhsGenerate, handleGenerateXhsImage,
                    
                    // 翻译
                    translateForm, translateGenerating, translateResultImage,
                    handleTranslateGenerate,
                    
                    // 模特换装
                    tryonForm, tryonGenerating, tryonResultImage,
                    handleTryonGenerate,
                    
                    // 视频带货
                    videoForm, videoRefImages, videoGenerating, videoGeneratedItems,
                    handleVideoGenerate, downloadSingleVideo,
                    
                    // 自由创作
                    freeForm, freeGenerating, handleFreeGenerate,
                    
                    // 提示词生成
                    mainPromptGenerating, detailPromptGenerating,
                    mainGeneratedPrompt, detailGeneratedPrompt,
                    generatePrompt, checkAdvertisingLaw,
                    
                    // 核心生成
                    mainGenerating, detailGenerating, whitebgGenerating, cloneGenerating,
                    mainGeneratedImages, detailGeneratedImages,
                    showGeneratingModal, generatingTaskCount, generatingModalInfo,
                    handleGenerate, cancelGeneration, createPlaceholderImg,
                    
                    // 支付系统
                    showRechargeModal, showVipModal, showCreditsModal,
                    selectedPackage, selectedVipPackage, selectedCreditPackage,
                    payMethod, paying, creditPaying, vipPaying,
                    orderCreating, creditOrderCreating, vipOrderCreating,
                    payQrCode, vipPayQrCode, currentOrderId, orderPrice,
                    payStatusText, payStatusClass, vipPayStatusText,
                    customCreditsAmount, creditsBuying, creditsPackages, customCreditsPrice,
                    openRecharge, openVipModal, openCreditsModal,
                    handleCreateOrder, handleBuyCredit, handleBuyCredits,
                    fetchPaymentQR, fetchVipQR, startPolling, startVipPolling,
                    cancelPayment, cancelVipPayment, loadCreditPackages,
                    
                    // 会员系统
                    memberInfo, loadMemberInfo, loadUserInfo,
                    checkMemberBeforeGenerate,
                    
                    // 历史记录
                    historyRecords, saveHistory, deleteHistoryRecord, clearHistory,
                    
                    // 灯箱
                    lightboxShow, lightboxImg, lightboxIdx, lightboxTotal,
                    openLightbox, closeLightbox, prevLightbox, nextLightbox,
                    
                    // 下载
                    downloadSingleImage, downloadAllSingle, downloadLongImage,
                    
                    // 编辑面板
                    editPanelShow, editTargetImg, editPromptText, editReconstructing,
                    openEditPanel, closeEditPanel, doReconstruct,
                    
                    // 存储
                    saveToStorage, loadFromStorage,
                    
                    // 作品集
                    portfolioItems, showPortfolioModal, currentPortfolioItem,
                    viewPortfolio, fetchPortfolio,
                    
                    // 分销
                    showReferralCenter, referralStats, referralList,
                    inviteLink, showPosterDialog, posterCanvasUrl,
                    showWithdrawDialog, withdrawForm,
                    loadReferralInfo, loadReferralCommissions, loadMoreCommissions,
                    copyInviteLink, drawPoster, downloadPoster, submitWithdraw,
                    
                    // 聊天
                    chatMessages, chatInputText, chatGenerating, chatModelId,
                    showChatDialog,
                    
                    // 系统
                    siteInfo, availableModels, domainAuthChecked, domainAuthBlocked,
                    currentDomain, checkDomainAuth, loadSiteInfo, checkSessionStatus,
                    
                    // 工具
                    Toast, copyToClipboard, fallbackCopy, roundRect
                };
            }
        });

        app.mount('#app');
        
        // 显示应用
        document.getElementById('app').style.display = 'block';
        hideLoadingPage();
        console.log('✅ 应用挂载成功！');

        // 初始化
        checkDomainAuth();
        loadSiteInfo();
        if (isLoggedIn.value) loadMemberInfo();
        checkSessionStatus();
        
    } catch (err) {
        console.error('❌ 初始化失败:', err);
        showErrorPage('初始化失败: ' + (err.message || err));
    }
}
