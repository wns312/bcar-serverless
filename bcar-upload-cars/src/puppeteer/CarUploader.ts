import { writeFile, mkdir, rm } from "fs/promises"
import { ElementHandle, FileChooser, Page, TimeoutError } from "puppeteer"
import { CarDataObject, ManufacturerOrigin, UploadSource } from "../types"
import { delay } from "../utils"

// 이 클래스의 인스턴스가 할 일은
// 1. 자신이 삭제해야할 차량의 목록을 리턴하는 것 (DB에서 삭제할 수 있도록)
// 2. 자신에게 부족한 차량의 개수를 리턴하는 것 (필요한 만큼의 차량을 인자로 받을 수 있도록? 또는 리스트를 받아 하나씩 pop 할수도 있음. 이건 문제가 될 수 있음. 보류)
// 3. 자신이 새로 등록한 차량의 목록을 리턴하는 것. 또는 자신이 등록한 모든 차량의 목록을 리턴하는 것 (이렇게 하면 새로 조회해서 갱신해줄 수 있음)

export class CarUploader {
  static formBase = "#post-form > table:nth-child(10) > tbody > tr"
  // static registerPageWaitSelector = "#post-form > div:nth-child(19) > div.photo_view.clearfix > div > span.custom-button-box > label:nth-child(1)"

  // Car Categorize related
  static originSelectorBase =  CarUploader.formBase + ":nth-child(2) > td > p > label"
  static domesticSelector = CarUploader.originSelectorBase + ":nth-child(1)"
  static importedSelector = CarUploader.originSelectorBase + ":nth-child(2)"

  static segmentBase =  CarUploader.formBase + ":nth-child(1) > td > label"
  static segmentSmallSelector = CarUploader.segmentBase + ":nth-child(1)"
  static segmentMediumSelector = CarUploader.segmentBase + ":nth-child(2)"
  static segmentLargeSelector = CarUploader.segmentBase + ":nth-child(3)"
  static segmentSportCarSelector = CarUploader.segmentBase + ":nth-child(4)"
  static segmentRecreationalSelector = CarUploader.segmentBase + ":nth-child(5)"
  static segmentVanSelector = CarUploader.segmentBase + ":nth-child(6)"
  static segmentBusAndTruckSelector = CarUploader.segmentBase + ":nth-child(7)"

  static companyBase = "#categoryId > dl.ct_a > dd > ul > li"
  static companyDataValueBase = CarUploader.companyBase + ".cateid-"

  static modelBase = "#categoryId > dl.ct_b > dd > ul > li"
  static modelDataValueBase = CarUploader.modelBase + ".cateid-"

  static detailModelBase = "#categoryId > dl.ct_c > dd > ul > li"
  static detailModelDataValueBase = CarUploader.detailModelBase + ".cateid-"

  static modelNameInputSelector = "#model-name-display > input"

  // Car Information related
  static carNumberInputSelector =  CarUploader.formBase + ":nth-child(7) > td > input"

  static modelYearSelector =  CarUploader.formBase + ":nth-child(8) > td > select.cof-select.cof-select-year.cof-form.cof-select-done"
  static modelMonthSelector =  CarUploader.formBase + ":nth-child(8) > td > select.cof-select.cof-select-month.cof-form.cof-select-done"

  static mileageInputSelector =  CarUploader.formBase + ":nth-child(9) > td > input"
  static displacementInputSelector =  CarUploader.formBase + ":nth-child(11) > td > input"
  static fuelTypeSelector = CarUploader.formBase + ":nth-child(13) > td > select"
  static priceInputSelector =  CarUploader.formBase + ":nth-child(19) > td > input"

  // gearBox
  static gearboxAutoSelector = CarUploader.formBase + ":nth-child(10) > td > label:nth-child(1)"
  static gearboxManualSelector = CarUploader.formBase + ":nth-child(10) > td > label:nth-child(2)"
  static gearboxCvtSelector = CarUploader.formBase + ":nth-child(10) > td > label:nth-child(3)"
  static gearboxSemiAutoSelector = CarUploader.formBase + ":nth-child(10) > td > label:nth-child(4)"

  // hasAccident
  static hasAccidentTrueSelector = CarUploader.formBase + ":nth-child(16) > td > label:nth-child(1)"
  static hasAccidentFalseSelector = CarUploader.formBase + ":nth-child(16) > td > label:nth-child(2)"
  static hasAccidentTextareaSelector = "#accident-display > textarea"
  // Seizure Mortgage
  static seizureMortgageBase = "#post-form > table:nth-child(15) > tbody > tr"
  static hasSeizureFalseSelector = CarUploader.seizureMortgageBase + ":nth-child(1) > td > label:nth-child(1)"
  static hasSeizureTrueSelector = CarUploader.seizureMortgageBase + ":nth-child(1) > td > label:nth-child(2)"
  static hasMortgageFalseSelector = CarUploader.seizureMortgageBase + ":nth-child(2) > td > label:nth-child(1)"
  static hasMortgageTrueSelector = CarUploader.seizureMortgageBase + ":nth-child(2) > td > label:nth-child(2)"
  // static hasSeizureNullSelector = CarUploader.seizureMortgageBase + ":nth-child(1) > td > label:nth-child(3)"
  // static hasMortgageNullSelector = CarUploader.seizureMortgageBase + ":nth-child(2) > td > label:nth-child(3)"

  // color
  static colorSelectSelector = "#carColorItem_title"
  static colorItemSelectSelector = "#carColorItem_child > ul"
  static colorChildBaseSelector = "#carColorItem_child > ul > li"
  static colorChoiceSelector = CarUploader.colorChildBaseSelector + ":nth-child(1)" // 선택
  static colorBlackSelector = CarUploader.colorChildBaseSelector + ":nth-child(2)" // 검정
  static colorRatSelector = CarUploader.colorChildBaseSelector + ":nth-child(3)" // 쥐
  static colorSilverSelector = CarUploader.colorChildBaseSelector + ":nth-child(4)" // 은
  static colorSilverGreySelector = CarUploader.colorChildBaseSelector + ":nth-child(5)" // 은회
  static colorWhiteSelector = CarUploader.colorChildBaseSelector + ":nth-child(6)" // 흰
  static colorPearlSelector = CarUploader.colorChildBaseSelector + ":nth-child(7)" // 진주
  static colorGalaxySelector = CarUploader.colorChildBaseSelector + ":nth-child(8)" // 은하
  // CarUploader.colorChildBaseSelector + ":nth-child(9)" // 명은
  // CarUploader.colorChildBaseSelector + ":nth-child(10)" // 갈대
  // CarUploader.colorChildBaseSelector + ":nth-child(11)" // 연금
  static colorBrownSelector = CarUploader.colorChildBaseSelector + ":nth-child(12)" // 갈
  static colorGoldSelector = CarUploader.colorChildBaseSelector + ":nth-child(13)" // 금
  static colorBlueSelector = CarUploader.colorChildBaseSelector + ":nth-child(14)" // 청
  static colorSkySelector = CarUploader.colorChildBaseSelector + ":nth-child(15)" // 하늘
  // CarUploader.colorChildBaseSelector + ":nth-child(16)" // 담녹
  static colorGreenSelector = CarUploader.colorChildBaseSelector + ":nth-child(17)" // 녹
  static colorPeaGreenSelector = CarUploader.colorChildBaseSelector + ":nth-child(18)" // 연두
  static colorEmeraldSelector = CarUploader.colorChildBaseSelector + ":nth-child(19)" // 청옥
  static colorRedSelector = CarUploader.colorChildBaseSelector + ":nth-child(20)" // 빨간
  static colorOrangeSelector = CarUploader.colorChildBaseSelector + ":nth-child(21)" // 주황
  // static colorPurpleSelector = CarUploader.colorChildBaseSelector + ":nth-child(22)" // 자주
  static colorVioletSelector =  CarUploader.colorChildBaseSelector + ":nth-child(23)" // 보라
  static colorPinkSelector = CarUploader.colorChildBaseSelector + ":nth-child(24)" // 분홍
  static colorYellowSelector = CarUploader.colorChildBaseSelector + ":nth-child(25)" // 노랑
  static colorEtcSelector =  CarUploader.colorChildBaseSelector + ":nth-child(26)" // 기타
  static colorEtcInputSelector = "#color-etc-display > input"

  // file
  static fileChooserSelector = "#post-form > div:nth-child(19) > div.photo_view.clearfix > div > span.custom-button-box > label:nth-child(1)"
  static imageRegisterButtonSelector = "#post-form > div:nth-child(21) > div.photo_view.clearfix > div > span.custom-button-box > label:nth-child(1)"
  static fileUploadedPreviewSelector = "#post-form > div:nth-child(19) > div.photo_view.clearfix > div > ul > li.ui-state-default.picture_first > span"
  // sumbmit input
  static submitInputSelector = "#post-form > div.submit_area > input.cof-btn.cof-btn-large.btn_add"

  constructor(
    private id: string,
    private registerUrl: string,
    private sources: UploadSource[]
    ) {}

  static getImageRootDir(id: string) {
    return `./images/${id}`
  }

  static getImageDir(id: string, carNumber: string) {
    return CarUploader.getImageRootDir(id) +`/${carNumber}`
  }

  static getImagePath(id: string, carNumber: string, imageName: string) {
    return CarUploader.getImageDir(id, carNumber) + imageName
  }

  static getOriginSelector(origin: ManufacturerOrigin) {
    return origin === ManufacturerOrigin.Domestic ? CarUploader.domesticSelector : CarUploader.importedSelector
  }

  static getSegmentSelector(segmentName: string) {
    switch (segmentName) {
      case "경소형":
        return CarUploader.segmentSmallSelector
      case "준중형":
        return CarUploader.segmentMediumSelector
      case "중대형":
        return CarUploader.segmentLargeSelector
      case "스포츠카":
        return CarUploader.segmentSportCarSelector
      case "SUV/RV":
        return CarUploader.segmentRecreationalSelector
      case "승합":
        return CarUploader.segmentVanSelector
      case "화물/버스":
        return CarUploader.segmentBusAndTruckSelector
      default:
        throw new Error("No proper segment");
    }
  }

  static getYearMonthFromString(yearMonth: string) {
    const [yearRaw, monthRaw] = yearMonth.split(" ")
    return {
      year: yearRaw.replace("년", ""),
      month: monthRaw.replace("월", ""),
    }
  }

  static getFuelType(fuelType: string) {
    switch (fuelType) {
      case "휘발유":
        return "gasoline";
      case "경유":
        return "diesel";
      case "LPG":
        return "lpg";
      case "전기":
        return "electric";
      case "수소":
        return "hydrogen";
      case "CNG":
        return "cng";
      case "하이브리드":
      case "겸용":
        return "hybrid_gasoline";
      default:
        return "gasoline";
        // throw new Error("No proper fuel type")
    }
  }

  static getGearType(gearType: string) {
    switch (gearType) {
      case "오토":
      return CarUploader.gearboxAutoSelector
      case "수동":
      return CarUploader.gearboxManualSelector
      case "CVT":
      return CarUploader.gearboxCvtSelector
      case "오토":
      return CarUploader.gearboxSemiAutoSelector
      default:
        return CarUploader.gearboxAutoSelector
        // throw new Error("No proper gear type")
    }
  }

  static getHasAccident(hasAccident: string) {
    switch (hasAccident) {
      case "무사고":
      case "-":
      return CarUploader.hasAccidentFalseSelector
      case "유사고":
      return CarUploader.hasAccidentTrueSelector
      default:
        throw new Error("No proper accident type")
    }
  }

  static getColor(color: string) {
    switch (color) {
      case "검정색":
      case "검정":
      case "검정투톤":
        return CarUploader.colorBlackSelector
      case "흰색":
      case "흰색투톤":
        return CarUploader.colorWhiteSelector
      case "진주색":
      case "진주투톤":
      case "베이지":
        return CarUploader.colorPearlSelector
      case "쥐색":
        return CarUploader.colorRatSelector
      case "은하색":
        return CarUploader.colorGalaxySelector
      case "은색":
      case "은색투톤":
      case "은회색":
        return CarUploader.colorSilverSelector
      case "회색":
      case "회색투톤":
      case "진회색":
      case "검정쥐색":
        return CarUploader.colorSilverGreySelector
      case "파랑(남색,곤색)":
      case "청색":
      case "남색":
      case "군청색":
      case "청색투톤":
      case "진청색":
        return CarUploader.colorBlueSelector
      case "하늘색":
        return CarUploader.colorSkySelector
      case "녹색":
      case "녹색투톤":
      case "담녹색":
      case "초록(연두)":
        return CarUploader.colorGreenSelector
      case "연두색":
        return CarUploader.colorPeaGreenSelector
      case "청옥색":
        return CarUploader.colorEmeraldSelector
      case "빨강색":
      case "빨강(주홍)":
      case "빨강투톤":
      case "흑장미색":
        return CarUploader.colorRedSelector
      case "분홍색":
        return CarUploader.colorPinkSelector
      case "주황색":
        return CarUploader.colorOrangeSelector
      case "노랑":
      case "노란색":
      case "겨자색":
        return CarUploader.colorYellowSelector
      case "금색":
        return CarUploader.colorGoldSelector
      case "밤색":
      case "갈색":
      case "갈대색":
      case "갈색(밤색)":
        return CarUploader.colorBrownSelector
      case "자주색":
      case "자주(보라)":
        return CarUploader.colorVioletSelector
      case "":
        return CarUploader.colorEtcSelector
      default:
        return CarUploader.colorEtcSelector
    }
  }

  static async saveImage(imageDir: string, url: string) {
    const response = await fetch(url)
    if (response.status !== 200) {
      console.error(response);
      throw new Error("Error response");
    }
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileNameList = url.split("_")
    const actualFileName = fileNameList[fileNameList.length-1]
    const fileDir = `${imageDir}/${actualFileName}`
    await writeFile(fileDir, buffer)
    return fileDir
  }

  static async saveImages(imageDir: string, carImgList: string[]) {
    if (!carImgList.length) {
      return []
    }
    return Promise.all(carImgList.map(carImg=>CarUploader.saveImage(imageDir, carImg)))
  }

  static async getFileChooser(page: Page, retry: number = 1): Promise<FileChooser> {
    console.log(`try: ${retry}`);
    try {
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 5000 }),
        page.click(CarUploader.fileChooserSelector)
      ])
      return fileChooser
    } catch(e) {
      if (!(e instanceof TimeoutError) || retry >= 5) {
        throw e
      }
    }
    console.log(`retry: ${retry}`);
    return await CarUploader.getFileChooser(page, retry + 1)
  }

  static async waitImageUpload(page: Page, retry: number = 1): Promise<ElementHandle<Element> | null> {
    try {
      const result = await page.waitForSelector(CarUploader.fileUploadedPreviewSelector, { timeout: 10000 * retry })
      return result
    } catch (e) {
      if (!(e instanceof TimeoutError) || retry >= 5) {
        throw e
      }
    }
    console.log(`retry: ${retry}`);
    return await CarUploader.waitImageUpload(page, retry + 1)
  }

  static async uploadImages(page: Page, dirList: string[]) {
    if (!dirList.length) {
      return null
    }
    console.log("fileChooser start");
    const fileChooser = await CarUploader.getFileChooser(page)
    console.log("fileChooser end");
    await fileChooser.accept(dirList);
    console.log("fileChooser.accept end");
    // 여기가 제대로 동작을 안함. 원인을 파악해야함
    return CarUploader.waitImageUpload(page)
  }

  static async inputCarInformation(page: Page, car: CarDataObject) {
    // console.log(car);
    // carNumber: 차량번호
    // mileage: 주행거리
    // displacement: 배기량
    // price: 가격
    const additionalPrice = 40
    const evaluateInput = {
      carNumberSelector: CarUploader.carNumberInputSelector,
      carNumberValue: car.carNumber,
      mileageSelector: CarUploader.mileageInputSelector,
      mileageValue: car.mileage.replace("Km", "").replace(",", ""),
      displacementSelector: CarUploader.displacementInputSelector,
      displacementValue: car.displacement.replace("cc", "").replace(",", "").replace("-", "0"),
      priceSelector: CarUploader.priceInputSelector,
      priceValue: (car.price + additionalPrice).toString(),
    }

    await page.evaluate(input=>{
      const {
        carNumberSelector,
        carNumberValue,
        mileageSelector,
        mileageValue,
        displacementSelector,
        displacementValue,
        priceSelector,
        priceValue
      } = input
      const carNumberInput = document.querySelector(carNumberSelector)
      const mileageInput = document.querySelector(mileageSelector)
      const displacementInput = document.querySelector(displacementSelector)
      const priceInput = document.querySelector(priceSelector)
      if (!carNumberInput || !mileageInput || !displacementInput || !priceInput) {
        console.table(input);
        throw new Error("No proper selector")
      }
      carNumberInput.setAttribute('value', carNumberValue)
      mileageInput.setAttribute('value', mileageValue)
      displacementInput.setAttribute('value', displacementValue)
      priceInput.setAttribute('value', priceValue)
    }, evaluateInput)

    // modelYear: 연식
    const { year, month } = CarUploader.getYearMonthFromString(car.modelYear)
    await page.select(CarUploader.modelYearSelector, year)
    await page.select(CarUploader.modelMonthSelector, month)
    // fuelType: 연료종류
    const fuelOption = CarUploader.getFuelType(car.fuelType)
    await page.select(CarUploader.fuelTypeSelector, fuelOption)
    // gearType: 변속기
    const gearRadioInput = CarUploader.getGearType(car.gearBox)
    await page.click(gearRadioInput)
    // hasAccident: 사고여부
    const hasAccicentInput = CarUploader.getHasAccident(car.hasAccident)
    await page.click(hasAccicentInput)
    if (hasAccicentInput === CarUploader.hasAccidentTrueSelector) {
      const accidentTextArea = await page.waitForSelector(CarUploader.hasAccidentTextareaSelector)
      if (accidentTextArea) {
        accidentTextArea?.type("-")
      }
    }
    // 압류: hasSeizure, 저당: hasMortgage
    const hasSeizureSelector = car.hasSeizure ? CarUploader.hasSeizureTrueSelector : CarUploader.hasSeizureFalseSelector
    const hasMortgageSelector = car.hasMortgage ? CarUploader.hasMortgageTrueSelector : CarUploader.hasMortgageFalseSelector
    await page.click(hasSeizureSelector)
    await page.click(hasMortgageSelector)
    // 색상: color
    const color = CarUploader.getColor(car.color)
    await page.click(CarUploader.colorSelectSelector)
    await page.waitForSelector(CarUploader.colorItemSelectSelector)
    await page.click(color)
    if (color === CarUploader.colorEtcSelector) {
      const carColorInput = await page.waitForSelector(CarUploader.colorEtcInputSelector)
      if (carColorInput) {
        await carColorInput.type("-")
      }
    }
  }

  static async categorizeCar(page: Page, source: UploadSource) {
    const { origin, carSegment, carCompany, carModel, carDetailModel, car } = source
    const originSelector = CarUploader.getOriginSelector(origin)
    const segmentSelector = CarUploader.getSegmentSelector(carSegment.name)
    // const companySelector1 = CarUploader.companyBase + `:nth-child(${carCompany.index})`
    const companySelector2 = CarUploader.companyDataValueBase + carCompany.dataValue

    await page.click(originSelector)
    await page.click(segmentSelector)
    await delay(100)
    // await page.click(companySelector1)
    await page.click(companySelector2)

    if (origin === ManufacturerOrigin.Imported || !carModel) {
      const carTitleInput = await page.waitForSelector(CarUploader.modelNameInputSelector)
      if (carTitleInput) {
        await carTitleInput.type(car.title)
      }
      return
    }
    // model은 있지만 detailModel이 없는 경우도 있을 수 있다.
    // 추후 문제가 생기는 경우 기타로 지정해서 carTitle을 적어주는 것을 고려해볼 것
    await delay(100)
    const modelSelector = CarUploader.modelDataValueBase + carModel?.dataValue
    await page.click(modelSelector)

    if (!carDetailModel) {
      return
    }

    await delay(100)
    const detailModelSelector = CarUploader.detailModelDataValueBase + carDetailModel.dataValue
    await page.click(detailModelSelector)
  }

  static async uploadCar(page: Page, id: string, source: UploadSource) {
    const imageDir = CarUploader.getImageDir(id, source.car.carNumber)
    try {
      // 사진
      await mkdir(imageDir)
      const dirList = await CarUploader.saveImages(imageDir, source.car.carImgList)
      // form 채우기
      await CarUploader.inputCarInformation(page, source.car)
      // 차량 카테고리 설정
      await CarUploader.categorizeCar(page, source)
      await page.focus(CarUploader.imageRegisterButtonSelector)
      // 이미지 업로드. 순서상 여기에 안넣으면 따로 delay를 넣어주어야 한다.
      // 업로드가 씹히기 때문.
      // 실제 fileChooser까지는 제대로 동작하지만, 실제 업로드 후 waitSelector가 제대로 동작하지 않는다.
      // 수정이 필요함. (로컬에서는 정상 동작하지만, 실제로는 동작하지 않음)
      await CarUploader.uploadImages(page, dirList)
      await page.click(CarUploader.submitInputSelector)
      await page.waitForNavigation({waitUntil: "load"})
    } catch (error) {
      console.error("차량 등록에 실패했습니다.");
      console.error(error);
      console.error(source);
    } finally {
      await rm(imageDir, { recursive: true, force: true })
    }
  }

  async uploadCars(page: Page) {
    try {
      for (const source of this.sources) {
        console.log(source.car.carNumber);

        await page.goto(this.registerUrl, { waitUntil: "networkidle2"})
        await page.waitForSelector(CarUploader.formBase)
        await CarUploader.uploadCar(page, this.id, source)
      }
    } catch (error) {
      console.error(error);
      console.log("실행 완료");
      // 만약 dialog 이벤트 없이 팝업이 뜨게 된다먄 그대로 계속 기다리게 된다.
      // 이후 타임아웃 에러가 발생하게 된다.
      // 모두 완료가 되었으면 차량 정보에 대한 DB 갱신이 있어야 한다.
      // uploader는 성공한 차량과, 실패한 차량에 대한 모든 목록을 리턴해주어야 한다.
      // dialog에서도 이를 처리해 줄 수 있도록 하자.
      // 또는 인스턴스 변수로 성공목록과 실패목록을 저장해두면, catch해서 쓸 수 있게 된다.
    }
  }
}
