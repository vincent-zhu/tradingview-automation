const fs = require('fs').promises;
const puppeteer = require('puppeteer');

const urlDict = {
    btcusdt: 'https://www.tradingview.com/chart/ufOPTWkQ/',
    ethusdt: 'https://www.tradingview.com/chart/8tG86THh/',
    ltcusdt: 'https://www.tradingview.com/chart/j5L9DGxr/',
    btcusd:  'https://www.tradingview.com/chart/yIpMOu6N/',
    ethusd:  'https://www.tradingview.com/chart/eFsbKVZD/'
};

const intervalDivDict = {
    s5: '#overlap-manager-root .item-2xPVYue0[data-value="5S"]',
    s15: '#overlap-manager-root .item-2xPVYue0[data-value="15S"]',
    m1: '#overlap-manager-root .item-2xPVYue0[data-value="1"]',
    m3: '#overlap-manager-root .item-2xPVYue0[data-value="3"]',
    m5: '#overlap-manager-root .item-2xPVYue0[data-value="5"]',
    m10: '#overlap-manager-root .item-2xPVYue0[data-value="10"]',
    m15: '#overlap-manager-root .item-2xPVYue0[data-value="15"]'
};

const getTargetUrl = function(name) {
    if (name in urlDict) {
        return urlDict[name];
    }

    return null;
};

const getIntervalDiv  = function(name) {
    if (name in intervalDivDict) {
        return intervalDivDict[name];
    } 

    return null;
};

(async function main() {
    try {
        const args = process.argv;
        if (args.length != 4) {
            console.error('Illegal argument');
            return -1;
        }

        const url = getTargetUrl(args[2]);
        const internalDiv = getIntervalDiv(args[3]);
        console.log(url);
        console.log(internalDiv);
        if (!url || !internalDiv) {
            console.error('Illegal argument');
            return -1;
        }

        // 打开浏览器
        const browser = await puppeteer.launch({
            headless: true, //不显示UI
            devtools: false,
            defaultViewport: false,
            args: [
                '--ignore-certificate-errors',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
        
        const context = await browser.createIncognitoBrowserContext();
        const page = await context.newPage();

        await page.setBypassCSP(true);
        const cookiesString = await fs.readFile('./cookies.json');
        const cookies = JSON.parse(cookiesString);
        await page.setCookie(...cookies);
        await page.setUserAgent('Mozilla / 5.0(Macintosh; Intel Mac OS X 10_15_5) AppleWebKit / 537.36(KHTML, like Gecko) Chrome / 84.0.4147.89 Safari / 537.36');
        page.on('console', msg => console.log(msg.text()));

        await page.goto(url);

        // 等待头部导航加载
        await page.waitFor('#header-toolbar-intervals');
        // 选择种类  menu-1fA401bY button-13wlLwhJ apply-common-tooltip
        await page.click('#header-toolbar-intervals');
        // item-2xPVYue0 data-value 1 切换为1分钟
        await page.click(internalDiv);

        // 挂载方法到window对象
        // page.exposeFunction('getValue', getValue);

        // 等待数据tip加载
        page
            .waitForSelector('.sourcesWrapper-2JcXD9TK .valueValue-3kA0oJs5')
            .then(() => {
                page.evaluate(() => {
                    function RGBToHex(rgb) {
                        var regexp = /[0-9]{0,3}/g;
                        var re = rgb.match(regexp);
                        var hexColor = '#';
                        var hex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
                        for (var i = 0; i < re.length; i++) {
                            var r = null,
                                c = re[i],
                                l = c;
                            var hexAr = [];
                            while (c > 16) {
                                r = c % 16;
                                c = (c / 16) >> 0;
                                hexAr.push(hex[r]);
                            }
                            hexAr.push(hex[c]);
                            if (l < 16 && l != '') {
                                hexAr.push(0);
                            }
                            hexColor += hexAr.reverse().join('');
                        }

                        return hexColor;
                    }

                    var ws;

                    function connectServer() {
                        ws = new WebSocket('ws://127.0.0.1:18888/message/upload');
                        ws.onopen = function (event) {
                            console.log('Server connected!');
                        };
                        ws.onmessage = function (event) {
                            console.log('received data');
                            console.log(event.data);
                        };
                        ws.onclose = function (event) {
                            console.log(event);
                            console.log('closed');
                            setTimeout(function () {
                                connectServer();
                            }, 3000);
                        };
                        ws.onerror = function (event) {
                            console.log('error');
                            ws.close();
                        };
                    }

                    const uploadData = function (data) {
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            try {
                                console.log('send');
                                ws.send(JSON.stringify(data));
                            } catch (error) {
                                console.log(error);
                            }
                        }
                    };

                    const uploadBarCloseIndicators = function (barTime, baseInfo, indicators) {
                        const now = new Date().getTime();
                        const start = calcStartTime(barTime, baseInfo.interval);
                        const end = calcEndTime(barTime, baseInfo.interval);
                        const data = {
                            version: 1,
                            msgId: '',
                            msgType: 'tvIndicator',
                            msgSource: 'tv',
                            occurTime: now,
                            data: {
                                tradeInfo: baseInfo,
                                timePeriod: { start: start, end: end },
                                indicators: indicators,
                            },
                        };
                        uploadData(data);
                    };

                    const parseIndicators = function () {
                        const indicatorsCount = document.querySelectorAll(' div.chart-data-window > div').length;
                        const indicatorData = [];

                        var index = 2;
                        for (var i = 1; i < indicatorsCount; i++) {
                            const title = document.querySelectorAll('div.chart-data-window-header')[i].children[0].title;
                            const params = [];

                            const bodyCount = document.querySelectorAll('div.chart-data-window-body')[i].children.length;
                            for (var j = 0; j < bodyCount; j++) {
                                var paramName = document.querySelectorAll('div.chart-data-window-body>div>div.chart-data-window-item-title')[index].innerText; //指标的参数名
                                var paramValue = document.querySelectorAll('div.chart-data-window-body>div>div.chart-data-window-item-value')[index].innerText; //指标的参数值
                                var paramColor = RGBToHex(document.querySelectorAll('div.chart-data-window-body>div>div.chart-data-window-item-value')[index].children[0].style.color);

                                params.push({ name: paramName, value: paramValue, color: paramColor });

                                index += 1;
                            }
                            indicatorData.push({ name: title, params: params });
                        }

                        return indicatorData;
                    };

                    const parseDateTime = function () {
                        const titleList = document.querySelectorAll('div.chart-data-window-body>div>div.chart-data-window-item-title');
                        const itemList = document.querySelectorAll('div.chart-data-window-body>div>div.chart-data-window-item-value');
                        var dateText = null;
                        var timeText = null;
                        if (titleList.length > 0 && itemList.length > 0) {
                            if (titleList.item(0).innerText.toLowerCase() === 'date') {
                                dateText = itemList.item(0).innerText;
                            }
                        }

                        if (titleList.length > 1 && itemList.length > 1) {
                            if (titleList.item(1).innerText.toLowerCase() === 'time') {
                                timeText = itemList.item(1).innerText;
                            }
                        }

                        if (dateText) {
                            if (timeText) {
                                const timeLen = timeText.split(':').length;
                                if (timeLen == 2) {
                                    return Date.parse(dateText + ' ' + timeText + ':00 GMT');
                                } else if (timeLen == 3) {
                                    return Date.parse(dateText + ' ' + timeText + ' GMT');
                                }
                            }
                        }

                        return 0;
                    };

                    const parseInterval = function (intervalStr) {
                        var times = 1000 * 60;
                        intervalStr = intervalStr.toLowerCase();
                        var numStr = intervalStr;
                        var endPos = intervalStr.length;
                        if (intervalStr.lastIndexOf('h') != -1) {
                            endPos = intervalStr.lastIndexOf('h');
                            times = 1000 * 60 * 60;
                        } else if (intervalStr.lastIndexOf('d') != -1) {
                            endPos = intervalStr.lastIndexOf('d');
                            times = 1000 * 60 * 60 * 24;
                        } else if (intervalStr.lastIndexOf('w') != -1) {
                            endPos = intervalStr.lastIndexOf('w');
                            times = 1000 * 60 * 60 * 24 * 7;
                        } else if (intervalStr.lastIndexOf('m') != -1) {
                            endPos = intervalStr.lastIndexOf('m');
                            times = 1000 * 60 * 60 * 24 * 7 * 30;
                        } else if (intervalStr.lastIndexOf('s') != -1) {
                            endPos = intervalStr.lastIndexOf('s');
                            times = 1000;
                        }

                        numStr = intervalStr.substring(0, endPos);
                        const num = parseInt(numStr);
                        return num * times;
                    };

                    const parseBaseInfo = function () {
                        const headerList = document.querySelectorAll('div.chart-data-window-header>span');
                        if (headerList.length > 1) {
                            const title = headerList.item(1).innerText;
                            const titleList = title.split(', ');
                            if (titleList.length === 3) {
                                const interval = parseInterval(titleList[1]);
                                if (!isNaN(interval)) {
                                    return { symbol: titleList[0], exchange: titleList[2], interval: interval };
                                }
                            }
                        }

                        return null;
                    };

                    const calcStartTime = function (now, interval) {
                        return calcIntervalTimestamp(now, interval, -1);
                    };

                    const calcEndTime = function (now, interval) {
                        return calcIntervalTimestamp(now, interval, 0);
                    };

                    const calcNowEndTime = function (now, interval) {
                        return calcIntervalTimestamp(now, interval, 1);
                    };

                    const calcIntervalTimestamp = function (now, interval, step) {
                        const times = Math.floor(now / interval);
                        return interval * (times + step);
                    };

                    var cachedIndicators = null;
                    var prevBarTime = 0;

                    const observeVolume = function () {
                        const target = document.querySelector('.sourcesWrapper-2JcXD9TK .valueValue-3kA0oJs5');
                        if (target) {
                            console.log('find target');
                            const observer = new MutationObserver(mutationsList => {
                                console.log('Mutation detected!');
                                var dataWindowList = document.querySelectorAll('div.active > div.widgetbar-widget-datawindow div.chart-data-window>div');
                                if (dataWindowList.length > 0) {
                                    try {
                                        const baseInfo = parseBaseInfo();
                                        const currBarTime = parseDateTime();

                                        if (baseInfo == null || currBarTime == 0) {
                                            return;
                                        }

                                        const indicators = parseIndicators();
                                        const now = new Date().getTime();
                                        const timeDiff = now - currBarTime;
                                        const barTimeDiff = currBarTime - prevBarTime;
                                        console.log(timeDiff);
                                        console.log(barTimeDiff);
                                        console.log(baseInfo.interval);
                                        if (timeDiff > baseInfo.interval + 3 * 1000) {
                                            uploadBarCloseIndicators(currBarTime, baseInfo, indicators);
                                        } else {
                                            if (barTimeDiff == baseInfo.interval) {
                                                uploadBarCloseIndicators(currBarTime, baseInfo, cachedIndicators);
                                            } else {
                                                cachedIndicators = indicators;
                                            }
                                            prevBarTime = currBarTime;
                                        }
                                    } catch (error) {
                                        console.log(error);
                                    }
                                }
                            });

                            observer.observe(target, {
                                characterData: true,
                                attributes: false,
                                childList: false,
                                subtree: true,
                            });
                        } else {
                            setTimeout(function () {
                                observeVolume();
                            }, 1000 * 10);
                        }
                    };

                    const startObserve = function () {
                        connectServer();
                        setTimeout(function () {
                            observeVolume();
                        }, 1000 * 10);
                    };

                    startObserve();

                })
            });




    } catch (err) {
        console.error('err:' + err);
    }
})();
