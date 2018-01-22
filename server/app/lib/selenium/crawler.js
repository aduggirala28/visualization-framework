import { Builder, By } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import http from 'http';
import url from 'url';
import easyimg from 'easyimage';
import mkdirp from 'mkdirp';
import fs from 'fs';
import { dirname } from 'path';
import resemble from 'node-resemble-js';
import async from 'async';

const width = 1920;
const height = 3000;

let driver = null;
let finalCallback = null;
let currentDashboard = null;
let currentReportId = null;
let dashboardSettings = null;
let graphType = 'default';
let checkSubsetCall = false;

let errors = [];
let widgets = [];
let chromeOptions = new chrome.Options();

const MESSAGES = {
    ERROR: 'error',
    SUCCESS: 'success',
    URL_NOT_FOUND: 'Provided url does not exists',
    NO_WIDGET: 'Seems like an invalid Dashboard, no widgets found',
    WIDGETS_NOT_LOADING: 'Some of the widgets are still waiting for data.',
    WIDGET_DATA_ISSUE: ` widgets haven't loaded due to console errors.`,
};

export const crawl = function(reportId, dashboard, callback) {
  currentReportId = reportId;
  finalCallback = callback;
  currentDashboard = dashboard;
  dashboardSettings = dashboard.settings;
  widgets = [];
  errors = [];
  checkAndProcess(dashboard.url);
};

const callback = function(type, message) {
    if(driver) {
        driver.quit();
        driver = null;
    }

    if(message)
      errors.push(message);
    finalCallback({
      type: type,
      widgets: widgets,
      errors: errors,
    });
};


const getMatchPercentage = function({ size, location, srcFile, orgFile, dstFile, chartName }, matchCallback) {
  if (fs.existsSync(dstFile) && fs.existsSync(orgFile)) {
    resemble(dstFile).compareTo(orgFile).onComplete(function(data) {
      matchCallback(null, (data.misMatchPercentage > 10) ? 'fail' : 'pass');
      return;
    });
  } else {
    matchCallback(null, null);
  }
};


const goToUrl = function(driver, Id, indexToClick) {
    driver.findElement(By.id(Id))
    .findElements(By.className('bar-block'))
    .then(function(elements) {
        elements.forEach(function(element, index) {
            if(index==0) {
                element.click().then(function() {
                    driver.wait(function() {
                        return driver.findElements(By.xpath('//div[contains(@class,"react-grid-layout")]/div')).then(function(elements) {
                            return elements.length;
                        });
                    }, 5000).then(function() {
                        driver.getCurrentUrl().then((url)=>{
                            fetchWidgets(url, 'bar');
                        });
                    });
                });
            }
        });
    });
    return true;
};

const cropImage = function({ size, location, srcFile, orgFile, dstFile, chartName }, matchCallback) {
    easyimg.crop({
        src: srcFile,
        dst: dstFile,
        cropwidth: size.width,
        cropheight: size.height,
        quality: 100,
        x: location.x,
        y: location.y,
        gravity: 'NorthWest',
    }).then(
      function(image) {
        matchCallback();
      },
      function(err) {
        console.log(err);
      }
    );
};

const checkAndProcess = function(URL) {
    let options = {
          method: 'HEAD',
          host: url.parse(URL).hostname,
          port: url.parse(URL).port,
      };
      try {
          let req = http.request(options, function(r) {
              console.log('here');
              if(r.statusCode == 200) {
                  initiate(URL);
              } else {
                  callback(MESSAGES.ERROR, MESSAGES.URL_NOT_FOUND);
              }
          });

          req.on('error', function(error) {
             callback(MESSAGES.ERROR, MESSAGES.URL_NOT_FOUND);
          });

          req.end();
      } catch(e) {
          console.log(e);
      }
};

const initiate = function(URL) {
    driver = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions.headless().windowSize({ width, height }))
        .build();

    driver.get(URL);

    driver.wait(function() {
        return driver.findElements(By.xpath("//div[contains(@class,'react-grid-layout')]/div")).then(function(elements) {
            return elements.length;
        });
      }, 5000).then(function() {
            //goToUrl(driver, 'test-stackbar-graph-horizontal-number-limit');
            fetchWidgets(URL,'default');
      }).catch(function() {
          callback(MESSAGES.ERROR, MESSAGES.NO_WIDGET);
      });
}

const fetchWidgets = function(URL,typeUrl) {
    
    driver.wait(function() {
        return driver.findElements(By.className('fa-spin')).then(function(elements) {
          return !elements.length;
        });
      }, 60000).catch(function() {
          errors.push(MESSAGES.WIDGETS_NOT_LOADING)
      });


      let allChartsLoaded = 0;
      let chartLocation;
      let chartSize;
      let chartStatus;
      let allElementsDetails=[];


      driver.findElements(By.xpath("//div[contains(@class,'react-grid-layout')]/div/div")).then(function(elems) {
          elems.forEach( function(elem) {
              elem.getAttribute('id').then(function(name, index){
                  if(name == "") {
                    allChartsLoaded++;
                  } else {
                    elem.getLocation().then(function(location){
                        chartLocation = location;
                    });
                    elem.getSize().then(function(size){
                        chartSize = size;
                    });
                    
                    elem.findElements(By.xpath(".//span[contains(@class,'fa-spin') or contains(@class,'fa-bar-chart') or contains(@class,'fa-meh-o')]")).then(function(elements) {
                      chartStatus = elements.length ? 'fail' : null;

                      allElementsDetails.push({
                          name: name,
                          location: chartLocation,
                          size: chartSize,
                          status: chartStatus,
                        });

                    });
                  }
              });

          });
      });

      driver.takeScreenshot().then(
          function(image, err) {
                
                let filePath;    
                let filePath2;
                
                if(graphType=='default') {
                        filePath = `public/dashboards/${currentReportId}/${currentDashboard.dashboard_id}/${currentDashboard.dataset_id ? currentDashboard.dataset_id : 0}`;
                } else {

                    filePath = `public/dashboards/${currentReportId}/${currentDashboard.dashboard_id}/${currentDashboard.dataset_id ? currentDashboard.dataset_id : 0}/${graphType}`;
                    graphType='default';       
                }
                let originalPath = `public/dashboards/original/${currentDashboard.dashboard_id}/${currentDashboard.dataset_id ? currentDashboard.dataset_id : 0}`;

                mkdirp(dirname(`${filePath}/dashboard.png`), function (err) {
                if (err)
                    return callback(MESSAGES.ERROR, {});

                fs.writeFile(`${filePath}/dashboard.png`, image, 'base64', function(err) {
                    if (err) {
                        console.log(err);
                    } else {
                        if(allChartsLoaded) {
                            errors.push(`${allChartsLoaded}${MESSAGES.WIDGET_DATA_ISSUE}`)
                        }
                        let count = 0;
                        async.forEachOf(allElementsDetails, function (result, key, callback) {
                            
                            let imageDetails = {
                                size: result.size,
                                location: result.location,
                                srcFile: `${filePath}/dashboard.png`,
                                orgFile: `${originalPath}/${result.name}.png`,
                                dstFile: `${filePath}/${result.name}.png`,
                                chartName: result.name,
                            };

                            let widget = {
                                chart_name: result.name,
                                type: 'before_click',
                            };
                            
                            if(typeUrl!='default') {
                                widget.type = 'after_click';
                            }

                            let settingsData = dashboardSettings ? JSON.parse(dashboardSettings) : null;

                            cropImage(imageDetails, function(err, response) {

                                if(result.status) {
                                    widgets.push(Object.assign({}, widget, {
                                        status: result.status,
                                    }));
                                    if( settingsData && settingsData.bar && result.name === settingsData.bar && !checkSubsetCall ) {
                                        checkSubsetCall = true;
                                        graphType = 'bar';
                                        return goToUrl(driver, settingsData.bar);
                                    }
                                    callback(null);
                                    return;
                                }

                                getMatchPercentage(imageDetails, function(err, response) {
                                    console.log('RESPONSE.....', response)
                                    if(response) {
                                        widgets.push(Object.assign({}, widget, {
                                            status: response,
                                        }));
                                    }
                                    if( settingsData && settingsData.bar && result.name === settingsData.bar && !checkSubsetCall ) {
                                        checkSubsetCall = true;
                                        graphType = 'bar';
                                        return goToUrl(driver, settingsData.bar);
                                    }
                                    callback(null);
                                    return;
                                });

                            });
                        }, function done() {
                            callback(MESSAGES.SUCCESS);
                        });
                    }

                });
              });
          });
}
