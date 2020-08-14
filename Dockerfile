FROM node:14 AS build

WORKDIR /usr/src/app

COPY package.json .
COPY yarn.lock .

RUN yarn install

FROM continuumio/miniconda3
RUN conda create -n env python=3.7.5
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

ENV PATH /opt/conda/envs/env/bin:$PATH
EXPOSE 5000
RUN conda install numpy==1.16.4 tensorflow==1.15.0 keras==2.3.1 pillow==7.0.0 bleach

COPY --from=build node_modules node_modules
COPY . .

CMD ["node", "index.js"]
