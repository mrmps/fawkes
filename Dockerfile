FROM node:14 AS build

WORKDIR /usr/src/app

COPY package.json .
COPY yarn.lock .

RUN yarn install

FROM continuumio/miniconda3
ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini


RUN apt-get install curl -y
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

RUN conda update -n base -c defaults conda
RUN conda create -n env python=3.7.5

ENV PATH /opt/conda/envs/env/bin:$PATH
RUN conda install numpy==1.16.4 tensorflow-gpu==1.14.0 keras==2.3.1 pillow==7.0.0 bleach

COPY --from=build /usr/src/app/node_modules node_modules
COPY . .

EXPOSE 5000

ENTRYPOINT ["/tini", "--"]

CMD ["node", "index.js"]
