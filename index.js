const puppeteer = require('puppeteer');
const user = require('./userConfig');
const { lagou: lagouUser, job51: job51User } = user;

const lagou = async (keyword) => {
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
  await page.type('body > section > div.left_area.fl > div:nth-child(2) > form > div:nth-child(1) > input', lagouUser.username);
  await page.type('body > section > div.left_area.fl > div:nth-child(2) > form > div:nth-child(2) > input', lagouUser.password);
  await page.click('body > section > div.left_area.fl > div:nth-child(2) > form > div.input_item.btn_group.clearfix > input');
  // await page.waitForNavigation();

  // 记录已经投递的公司
  const deliveryCompany = [];

  // 是否可以投递
  let canDelivery = true;

  async function delivery() {

    await page.goto(`https://www.lagou.com/jobs/list_${encodeURI(keyword)}?px=new&city=${encodeURI('广州')}#order`);
    // 等待招聘列表元素加载
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
    console.log(`是否已投递：${haveDelivery}`);
    if (haveDelivery) {
      deliveryCompany.push(jobId);
      return;
    }



    // 确定投递吗
    await page.click('#delayConfirmDeliver').catch(() => { });
    // 投递成功确认
    await page.click('#knowed').catch(() => { });
    // 投递失败确认
    await page.click('#uploadFile > table > tbody > tr:nth-child(2) > td > a').catch(() => { });

    // 检查是否达到投递上限
    const deliveryMax = await page.$eval('#upperLimit > table > tbody > tr:nth-child(1) > td > h4 > i', (deliveryNum) => {
      if (deliveryNum.innerText === '12') {
        return true;
      }
      return false;
    })
      .catch((error) => {
        return false;
      });
    console.log(deliveryMax, '已达到投递上限');
    if (deliveryMax) canDelivery = false;

    // await page.waitForNavigation();

    // 等待2秒
    await page.waitFor(2000);
  }

  let count = 0;
  while (canDelivery) {
    await delivery();
    console.log(count);
    count++;
  }

  await browser.close();
}




// 51job
// order: 0为智能排序；1为最新排序
const job51 = async (keyword, order) => {
  const browser = await puppeteer.launch({
    // headless: false,
    slowMo: 100
  });

  const page = await browser.newPage();

  // 投递页数
  const deliveryPageTotal = 10;

  page.setViewport({
    width: 1376,
    height: 768,
  });

  await page.goto('http://www.51job.com/');

  // 登录
  await page.click('body > div.content > div > div.ubox > div.sml.e_icon.radius_5 > div.abut_box > span.abut.showLogin');
  await page.type('#loginname', job51User.username);
  await page.type('#password', job51User.password);
  await page.click('#login_btn');

  await page.waitForNavigation();

  // 投递
  // pagination 页数
  async function delivery(pagination) {
    const pageLink = `http://search.51job.com/list/030200,000000,0000,00,9,99,${encodeURI(encodeURI(keyword))},2,${pagination}.html?lang=c&stype=1&postchannel=0000&workyear=99&cotype=99&degreefrom=99&jobterm=99&companysize=99&lonlat=0%2C0&radius=-1&ord_field=${order}&confirmdate=9&fromType=1&dibiaoid=0&address=&line=&specialarea=00&from=&welfare=`;

    await page.goto(pageLink);

    await page.waitForSelector('#resultList > .el > .t1 > span > a');

    // 获取过滤后的招聘列表
    const jobs = await page.$$eval('#resultList > .el > .t1 > span > a', (jobList) => {
      return jobList.map((job) => {
        let title = job.getAttribute('title').toLowerCase();
        let link = job.getAttribute('href');
        return {
          title,
          link
        };
      })
        .filter((job) => {
          let { title } = job;
          if (/java|php|ios|android|c#|net|as3|后端|安卓|测试|学徒|设计|实习|五险|助理|讲师|零基础|专员/.test(title)) return false;
          return true;
        });
    });

    // 投递简历
    for (let i = 0; i < jobs.length; i++) {
      let { link } = jobs[i];
      await page.goto(link);
      await page.waitForSelector('#app_ck');
      await page.click('#app_ck');
      await page.waitFor(1000);
      console.log(`投递完毕，当前第${i + 1}份招聘信息`);
    }

  }

  // 投递多少页
  for (let i = 1; i < deliveryPageTotal; i++) {
    console.log(`第${i}页`);
    await delivery(i);
  }

  await browser.close();

}

// lagou('web前端').catch(error => { console.log('err', error) });
job51('web前端开发', 0).catch(error => { console.log('err', error) });

