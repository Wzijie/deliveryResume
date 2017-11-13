const puppeteer = require('puppeteer');
const user = require('./userConfig');
const { lagou } = user;

const main = async () => {
  const browser = await puppeteer.launch({
    // 是否显示浏览器
    headless: false,
    // 操作间隔ms
    slowMo: 100,
  });
  const page = await browser.newPage();

  page.setViewport({
    width: 1376,
    height: 768,
  });

  await page.goto('https://passport.lagou.com/login/login.html');
  // await page.goto(`https://www.baidu.com`);
  // 登录
  await page.type('body > section > div.left_area.fl > div:nth-child(2) > form > div:nth-child(1) > input', lagou.username);
  await page.type('body > section > div.left_area.fl > div:nth-child(2) > form > div:nth-child(2) > input', lagou.password);
  await page.click('body > section > div.left_area.fl > div:nth-child(2) > form > div.input_item.btn_group.clearfix > input');
  // await page.waitForNavigation();

  // 记录以及投递的公司
  const deliveryCompany = [];
  // 是否达到投递上限
  let deliveryLimit = false;

  async function delivery() {


    await page.goto(`https://www.lagou.com/jobs/list_${encodeURI('web前端')}?px=new&city=${encodeURI('广州')}#order`);
    // 等待公司列表元素加载
    await page.waitForSelector('#s_position_list > .item_con_list > li');

    // 获取工作信息
    const jobs = await page.$$eval('#s_position_list > .item_con_list > li', (jobList) => {
      return jobList.map((job) => {
        const dataset = job.dataset;
        const [salary1, salary2] = dataset.salary.split('-');

        return {
          // 标题
          title: dataset.positionname.toLowerCase(),
          // 公司
          company: dataset.company.toLowerCase(),
          // 工资范围
          salaryMin: parseInt(salary1, 10),
          salaryMax: parseInt(salary2, 10),
          // 用于进入招聘详情页
          id: parseInt(dataset.positionid, 10)
        };
      });
    });

    // 筛选后拿到第一条招聘信息id
    function getJobLink(jobs) {
      const goodJobs = jobs.filter((job) => {
        if (job.title.indexOf('java') !== -1) {
          return false;
        }
        if (deliveryCompany.indexOf(job.id) !== -1) {
          return false;
        }
        return true;
      });

      if (goodJobs.length > 0) {
        const job = goodJobs[0];
        return job.id;
      }

      return null;
    }

    const jobId = getJobLink(jobs);
    // 根据id进入招聘详情页
    await page.goto(`https://www.lagou.com/jobs/${jobId}.html`);
    // 点击投递
    await page.click('.resume-deliver > a');
    // 检查投递状态
    const haveDelivery = await page.$eval('.resume-deliver > a', (deliveryBtn) => {
      return deliveryBtn.innerText === '已投递';
    });
    // 已投递则记录id并退出
    if (haveDelivery) {
      deliveryCompany.push(jobId);
      return;
    }
    console.log(haveDelivery);

    // 检查是否达到投递上限
    const deliveryMax = await page.$eval('#upperLimit > table > tbody > tr:nth-child(2) > td > a.btn_upper', (addDeliveryNumBtn) => {
      return true;
    })
      .catch((error) => {
        return false;
      });
    console.log(deliveryMax, 'deliveryMax');
    deliveryLimit = deliveryMax;

    // 确定投递吗
    await page.click('#delayConfirmDeliver').catch(() => { });
    // 投递成功确认
    await page.click('#knowed').catch(() => { });
    // 投递失败确认
    await page.click('#uploadFile > table > tbody > tr:nth-child(2) > td > a').catch(() => { });
    // await page.waitForNavigation();
    // 等待2秒
    await page.waitFor(2000);
  }

  let num = 0;
  while (!deliveryLimit) {
    await delivery();
    console.log(num);
    num++;
  }

  // jobs.filter((job) => {
  //   if (job.title.indexOf('java') !== -1) {
  //     return false;
  //   }
  //   return true;
  // })
  // .forEach(async (job) => {
  //   await page.goto(`https://www.lagou.com/jobs/${job.id}.html`);
  //   const haveDelivery = page.$eval('.resume-deliver > a', (deliveryBtn) => {
  //     return deliveryBtn.innerText;
  //   });
  // })



  console.log(jobs);

  // await browser.close();
}

main().catch(error => { console.log('err', error) });
