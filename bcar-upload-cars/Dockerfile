FROM node:19-bullseye-slim
WORKDIR /app

RUN apt-get update && apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
RUN npm install -g typescript@4.8.4
RUN apt-get install -y chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json .
RUN npm ci
# 나중에 이 명령어는 불필요한 파일을 옮기지 않도록 수정되어야 한다.
# 추후 환경변수와 볼륨이 연결되지 않은 경우를 잘 생각해볼 것
ADD . ./
# 커멘드를 변경하는 경우 tsc를 Run 하지 않으면 컴파일이 이루어지지 않은 상태이므로, 실행을 따로 시켜준다.
RUN tsc
# 기본 커멘드로 지정된 것으로, 로컬환경에서 컨테이너를 테스트하기 위한 것
CMD tsc -watch
