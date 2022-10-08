import { PuppeteerNode } from "puppeteer-core";
import { DynamoClient } from "../db/dynamo/DynamoClient";

async function test() {
  const tableName = process.env.BCAR_TABLE!;
  const indexName = process.env.BCAR_INDEX!;
  const client = new DynamoClient("ap-northeast-1", tableName, indexName);

  let res = await client.getCar("5678");
  // console.log(res.Items);
  // res = await client.getCar("9999")
  // console.log(res.Items);
  // res = await client.getUser("JYK")
  // console.log(res.Items);
  // res = await client.getPost("5678", "JYK")
  // console.log(res.Items);
  // res = await client.getPost("9999", "JYK")
  // console.log(res.Items);
  // res = await client.getAllPostOfCar("5678")
  // console.log(res.Items);
  // res = await client.getAllPostOfCar("9999");
  // console.log(res.Items);
  // res = await client.getAllPostOfUser("JYK")
  // console.log(res.Items);
  res = await client.scan();
  console.log(res);

  // return;

  //   const chromium = require("chrome-aws-lambda");
  //   const puppeteer: PuppeteerNode = chromium.puppeteer
  //   const browser = await puppeteer.launch({
  //     args: chromium.args,
  //     defaultViewport: chromium.defaultViewport,
  //     executablePath: await chromium.executablePath,
  //     headless: chromium.headless
  //   });
  //   var [page] = await browser.pages();
  //   // const page = await browser.newPage();
  //   // waitUntil을 사용해야 로딩이 된다.
  //   await page.goto('http://mastermotors.co.kr/car/carView.html?m_no=8448854', { waitUntil: 'load' });

  //   let data_len = await page.$$eval( "#detail_box > div.right > div > div.carContTop > ul > li", data => {
  //       return data.length;
  //   });

  //   // 차 정보 가져오는 부분
  //   let carInfoKeys = []
  //   let carInfoValues = []
  //   for (let index = 1; index < data_len+1; index++) {
  //       carInfoKeys.push(
  //           page.$eval(`#detail_box > div.right > div > div.carContTop > ul > li:nth-child(${index}) > span.tit`, (data)=>{
  //               return data.textContent
  //           })
  //       )
  //       carInfoValues.push(
  //           page.$eval(`#detail_box > div.right > div > div.carContTop > ul > li:nth-child(${index}) > span.txt`, (data)=>{
  //               return data.textContent ? data.textContent.trim() : ''
  //           })
  //       )
  //   }
  //   const carCheckSrc = await page.$eval(`#detail_box > div:nth-child(21) > iframe`, (element)=>{
  //       return element.getAttribute('src')
  //   })

  //   // 이미지만 가져오기
  //   const imgLen = await page.$$eval(`#detail_box > div:nth-child(16) > a`, (element)=>{
  //       return element.length
  //   })
  //   const carImgList = []
  //   for (let index = 1; index < imgLen+1; index++) {
  //       carImgList.push(
  //           await page.$eval(`#detail_box > div:nth-child(16) > a:nth-child(${index}) > img`, (element)=>{
  //               return element.getAttribute('src')
  //           })
  //       )
  //   }
  //   console.log(await Promise.all(carInfoKeys));
  //   console.log(await Promise.all(carInfoValues));
  //   console.log(carCheckSrc);
  //   console.log(carImgList);

  //   await browser.close();
}

export { test };
