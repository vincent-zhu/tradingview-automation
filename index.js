const fs = require('fs').promises;
const puppeteer = require('puppeteer');

const urlDict = {
    btcusd: 'https://www.tradingview.com/chart/?symbol=BITMEX%3AXBTUSD'
};

const intervalDivDict = {
    m1: '#overlap-manager-root .item-2xPVYue0[data-value="1"]'
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
        // const browser = await puppeteer.launch({ 
        //     headless: false,
        //     executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' 
        // });
        const browser = await puppeteer.launch({ headless: true });
        const [page] = await browser.pages();

        // 不打开浏览器
        // const browser = await puppeteer.launch();
        // const page = await browser.newPage();

        await page.setBypassCSP(true);
        const cookiesString = await fs.readFile('./cookies.json');
        const cookies = JSON.parse(cookiesString);
        await page.setCookie(...cookies);
        page.on('console', msg => console.log(msg.text()));

        await page.goto(url);

        // 等待头部导航加载
        let top = await page.waitFor('#header-toolbar-intervals');
        await top;
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
                        var hexColor = "#";
                        var hex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
                        for (var i = 0; i < re.length; i++) {
                            var r = null, c = re[i], l = c;
                            var hexAr = [];
                            while (c > 16) {
                                r = c % 16;
                                c = (c / 16) >> 0;
                                hexAr.push(hex[r]);
                            }
                            hexAr.push(hex[c]);
                            if (l < 16 && l != "") {
                                hexAr.push(0)
                            }
                            hexColor += hexAr.reverse().join('');
                        }

                        return hexColor;
                    };

                    var ws;
                    var prevInterval = -1;
                    var prevTimeInfo = null;
                    var firstSend = false;
                    var startTime = new Date().getTime();
                    var lastUploadTime = new Date().getTime();

                    function connectServer() {
                        ws = new WebSocket('ws://127.0.0.1:18888/upload');
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

                    const uploadData = function (data, currInterval, currTimeInfo) {
                        if (ws) {
                            try {
                                console.log('send');
                                ws.send(JSON.stringify(data));
                                lastUploadTime = new Date().getTime();
                                prevInterval = currInterval;
                                prevTimeInfo = currTimeInfo;
                            } catch (error) {
                                console.log(error);
                            }
                        }
                    };

                    const uploadIndicators = function (baseInfo, timeInfo, timeout) {
                        console.log('indicator start');
                        console.log(timeout);
                        setTimeout(function () {
                            console.log('upload indicators');
                            const indicators = parseIndicators();
                            const data = {
                                version: 1,
                                msgId: '',
                                msgType: 'indicator',
                                msgSource: 'tv',
                                data: {
                                    code: 0,
                                    messsage: '',
                                    tradeInfo: baseInfo,
                                    indicators: indicators
                                }
                            };
                            uploadData(data, baseInfo.interval, timeInfo);
                        }, timeout);
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
                                var paramName = document.querySelectorAll('div.chart-data-window-body>div>div.chart-data-window-item-title')[index].innerText;//指标的参数名
                                var paramValue = document.querySelectorAll('div.chart-data-window-body>div>div.chart-data-window-item-value')[index].innerText;//指标的参数值
                                var paramColor = RGBToHex(document.querySelectorAll('div.chart-data-window-body>div>div.chart-data-window-item-value')[index].children[0].style.color)

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
                        var timeText = '';
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
                            return { date: dateText, time: timeText };
                        }

                        return null;
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
                    }

                    const calcStartTime = function (now, interval) {
                        return calcIntervalTimestamp(now, interval, 0);
                    }

                    const calcEndTime = function (now, interval) {
                        return calcIntervalTimestamp(now, interval, 1);
                    }

                    const calcIntervalTimestamp = function (now, interval, step) {
                        const times = Math.floor(now / interval);
                        return interval * (times + step)
                    }

                    const checkDataThenUpload = function (lastInterval) {
                        var interval = 1000;
                        const now = new Date().getTime();
                        var sendFlag = false;

                        var dataWindowList = document.querySelectorAll('div.active > div.widgetbar-widget-datawindow div.chart-data-window>div');
                        if (dataWindowList.length > 0) {
                            try {
                                const baseInfo = parseBaseInfo();
                                const timeInfo = parseDateTime();

                                if (baseInfo == null || timeInfo == null) {
                                    // TODO
                                } else {
                                    const currInterval = baseInfo.interval;
                                    console.log(prevInterval);
                                    console.log(currInterval);
                                    console.log(prevTimeInfo);
                                    console.log(timeInfo);
                                    if (prevInterval != currInterval) {
                                        sendFlag = true;
                                    } else {
                                        if ('time' in prevTimeInfo && 'time' in timeInfo) {
                                            if (prevTimeInfo['time'] != timeInfo['time']) {
                                                sendFlag = true;
                                            }
                                        } else if ('date' in prevTimeInfo && 'date' in timeInfo) {
                                            if (prevTimeInfo['date'] != timeInfo['date']) {
                                                sendFlag = true;
                                            }
                                        }
                                    }

                                    if (sendFlag) {
                                        console.log('upload');
                                        interval = 2000;
                                        uploadIndicators(baseInfo, timeInfo, 33);
                                        console.log('upload end');
                                    } else {
                                        const endTime = calcEndTime(now, baseInfo.interval);
                                        console.log(endTime);
                                        const diff = endTime - now;
                                        interval = diff * 0.618;
                                        console.log(interval);
                                        if (interval > lastInterval) {
                                            interval = lastInterval;
                                        }
                                        if (interval < 33) {
                                            interval = 33;
                                        }
                                    }
                                }
                            } catch (error) {
                                // TODO
                            }

                        }

                        setTimeout(function () {
                            checkDataThenUpload(interval);
                        }, interval);
                    }

                    const startCheck = function () {
                        connectServer();
                        setTimeout(function () {
                            startTime = new Date().getTime();
                            checkDataThenUpload(10 * 1000);
                        }, 1000 * 10)
                    };

                    startCheck();
                })
            });




    } catch (err) {
        console.error('err:' + err);
    }
})();