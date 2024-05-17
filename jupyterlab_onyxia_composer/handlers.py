import git
import json
from pathlib import Path
import os
import shutil
import yaml
import traceback

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado

DEFAULT_ICON_URL = "https://cdn.iconscout.com/icon/free/png-512/free-app-store-appstore-brand-logo-47402.png"
DOCKER_REPO = "registry.logilab.fr/open-source/dockerfiles/onyxia"
APP_DIR = Path.home() / "work" / "app"


class CreateServiceHandler(APIHandler):

    @tornado.web.authenticated
    def post(self):
        # input_data is a dictionary with a key "name"
        input_data = self.get_json_body()
        try:
            service = Service()
            service.create_service(input_data)
            message = service.message
        except Exception as e:
            message = traceback.print_exc()
        data = {"message": message}
        self.finish(json.dumps(data))


class CheckServiceExist(APIHandler):

    @tornado.web.authenticated
    def post(self):
        # input_data is a dictionary with a key "name"
        github_repo_dir = Path.home() / "work" / "helm-charts-logilab-services"
        repo = git.Repo(github_repo_dir)
        service = self.get_json_body().strip().replace(" ", "_").lower()
        # handle version
        version = "0.0.1"
        for tag in repo.tags:
            if service == "-".join(tag.name.split("-")[:-1]):
                current_version = tag.name.split("-")[-1]
                last_number = int(current_version.split(".")[-1])
                # increase version
                version = ".".join(
                    current_version.split(".")[:-1] + [str(last_number + 1)]
                )
        metadatas = {
            "version": version,
            "exist": False,
            "description": "",
            "icon": "",
        }
        # if exist handle metadatas
        service_path = github_repo_dir / "charts" / service
        if service and service_path.exists():
            metadatas["exists"] = True
            chart_path = service_path / "Chart.yaml"
            if chart_path.exists():
                with open(chart_path) as f:
                    chart_file = yaml.safe_load(f)
                metadatas["description"] = chart_file["description"]
                metadatas["icon"] = chart_file["icon"]
        self.finish(json.dumps(metadatas))


class CheckServiceVersion(APIHandler):
    @tornado.web.authenticated
    def post(self):
        github_repo_dir = Path.home() / "work" / "helm-charts-logilab-services"
        repo = git.Repo(github_repo_dir)
        input_data = self.get_json_body()
        version = input_data["version"]
        service_name = input_data["name"].strip().replace(" ", "_").lower()
        message = ""
        if (github_repo_dir / "charts" / service_name).exists():
            for tag in repo.tags:
                if service_name == "-".join(tag.name.split("-")[:-1]):
                    if tag.name.split("-")[-1] == version:
                        message = "This version already exist, choose another one"
                        break
        self.finish(json.dumps({"message": message}))


class ListServiceHandler(APIHandler):

    @tornado.web.authenticated
    def post(self):
        github_repo_dir = Path.home() / "work" / "helm-charts-logilab-services"
        repo = git.Repo(github_repo_dir)
        origin = repo.remote(name="origin")
        repo.git.checkout("main")
        origin.pull()
        services = {}
        for serv in os.listdir(github_repo_dir / "charts"):
            chart_path = github_repo_dir / "charts" / serv / "Chart.yaml"
            if chart_path.exists():
                services[serv] = {}
                with open(chart_path) as f:
                    chart_file = yaml.safe_load(f)
                services[serv]["description"] = chart_file["description"]
                for tag in repo.tags:
                    if serv == "-".join(tag.name.split("-")[:-1]).lower():
                        services[serv]["tag"] = tag.name
        data = {"services": services}
        self.finish(json.dumps(data))


def delete_service(service_name, update=False):
    github_repo_dir = Path.home() / "work" / "helm-charts-logilab-services"
    repo = git.Repo(github_repo_dir)
    origin = repo.remote(name="origin")

    repo.git.checkout("gh-pages")
    origin.pull()
    with open(github_repo_dir / "index.yaml") as f:
        index_file = yaml.safe_load(f)
    if service_name in index_file["entries"]:
        index_file["entries"].pop(service_name)
        with open(github_repo_dir / "index.yaml", "w") as f:
            yaml.safe_dump(index_file, f)
        repo.git.add(github_repo_dir / "index.yaml")
        repo.git.commit("-m", f"[auto] remove service {service_name}")
        origin.push()

    repo.git.checkout("main")
    origin.pull()
    repo.git.rm(github_repo_dir / "charts" / service_name, r=True)
    if (github_repo_dir / "images" / service_name).exists():
        repo.git.rm(github_repo_dir / "images" / service_name, r=True)
    if not update:
        repo.git.commit("-m", f"[auto] remove service {service_name}")
        origin.push()


class DeleteServiceHandler(APIHandler):

    @tornado.web.authenticated
    def post(self):
        input_data = self.get_json_body()
        service_name = input_data["service"]
        message = f"service {service_name} deleted"
        try:
            delete_service(service_name)
        except Exception as e:
            message = str(e)
        data = {"message": message}
        self.finish(json.dumps(data))


def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    # Prepend the base_url so that it works in a JupyterHub setting
    create_service_pattern = url_path_join(
        base_url, "jupyterlab-onyxia-composer", "create"
    )
    list_services_pattern = url_path_join(
        base_url, "jupyterlab-onyxia-composer", "services"
    )
    delete_service_pattern = url_path_join(
        base_url, "jupyterlab-onyxia-composer", "delete"
    )
    check_srv_name_pattern = url_path_join(
        base_url, "jupyterlab-onyxia-composer", "checkSrvName"
    )
    check_srv_version_pattern = url_path_join(
        base_url, "jupyterlab-onyxia-composer", "checkSrvVersion"
    )
    handlers = [
        (create_service_pattern, CreateServiceHandler),
        (list_services_pattern, ListServiceHandler),
        (delete_service_pattern, DeleteServiceHandler),
        (check_srv_name_pattern, CheckServiceExist),
        (check_srv_version_pattern, CheckServiceVersion),
    ]
    web_app.add_handlers(host_pattern, handlers)


class Service:

    def __init__(self):
        github_repo_dir = Path.home() / "work" / "helm-charts-logilab-services"
        self.service_template_dir = github_repo_dir / "charts-template"
        self.repo_charts_dir = github_repo_dir / "charts"
        self.images_dir = github_repo_dir / "images"
        self.service_version = "0.0.1"
        self.repo = git.Repo(github_repo_dir)
        self.message = ""

    def create_app(self, service_name, notebook_name, build_commands, app_path=None):
        """
        Create App from local directory or git repository
        depends on build_command variable
        """
        new_image_dir = self.images_dir / service_name
        try:
            os.mkdir(new_image_dir)
        except Exception as e:
            self.message = f"Directory {new_image_dir} already exist"
            raise e
        with open(self.images_dir / "Dockerfile-template", "r") as inf:
            with open(new_image_dir / "Dockerfile", "w") as outf:
                for line in inf:
                    if "${BUILD_COMMANDS}" in line:
                        outf.writelines(build_commands)
                    else:
                        outf.write(line)
        if app_path:
            for filename in os.listdir(app_path):
                if os.path.isdir(Path(app_path) / filename):
                    if not filename.startswith("."):
                        shutil.copytree(
                            Path(app_path) / filename, new_image_dir / filename
                        )
                else:
                    shutil.copy(Path(app_path) / filename, new_image_dir / filename)
        image = f"{DOCKER_REPO}/{service_name}:latest"
        return image

    def git_commit_and_push(self, service_name, service_dir, app_build_type):
        self.repo.index.add(service_dir)
        if app_build_type != "fromDockerImage":
            self.repo.index.add(self.images_dir / service_name)
        self.repo.index.commit(f"[auto] add {service_name} service")
        origin = self.repo.remote(name="origin")
        origin.push()

    def copy_templates(self, service_name, image, app_command, data):
        service_repo_dir = self.repo_charts_dir / service_name
        for finput in os.listdir(self.service_template_dir):
            if os.path.isdir(self.service_template_dir / finput):
                shutil.copytree(
                    self.service_template_dir / finput, service_repo_dir / finput
                )
                with open(
                    self.service_template_dir / finput / "statefulset.yaml", "r"
                ) as inf:
                    with open(
                        service_repo_dir / finput / "statefulset.yaml", "w"
                    ) as outf:
                        for line in inf:
                            outf.write(line.replace("${APP_COMMAND}", app_command))
            else:
                with open(self.service_template_dir / finput, "r") as inf:
                    with open(service_repo_dir / finput, "w") as outf:
                        for line in inf:
                            outf.write(
                                line.replace("${NAME}", service_name)
                                .replace("${DESCRIPTION}", data.get("desc", ""))
                                .replace("${IMAGE}", image)
                                .replace(
                                    "${ICONURL}",
                                    data.get("iconURL", DEFAULT_ICON_URL),
                                )
                                .replace(
                                    "${REPOURL}",
                                    data.get(
                                        "appRepoURL",
                                        f"{self.repo.remotes.origin.url}/tree/main/charts/{service_name}",
                                    ),
                                )
                                .replace("${VERSION}", self.service_version)
                                .replace(
                                    "${DEFAULT_CPU}",
                                    str(data["cpuLimit"]),
                                )
                                .replace(
                                    "${DEFAULT_MEMORY}",
                                    f"{data['memLimit']}Gi",
                                )
                            )

    def create_service(self, data):
        service_name = data["name"].strip().replace(" ", "_").lower()
        service_repo_dir = self.repo_charts_dir / service_name
        if (service_repo_dir).exists():
            delete_service(service_name, update=True)
        os.mkdir(service_repo_dir)
        # save metadatas
        with open(service_repo_dir / "jcomposer.json", "w") as f:
            json.dump(data, f)
        self.service_version = data["version"]
        app_build_type = data["appBuildType"]
        build_commands = []
        if data["appType"] == "jupyterlab":
            build_commands.extend(
                [
                    "RUN apt-get -y update && apt-get -y upgrade\n",
                    "RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -\n",
                    "RUN apt-get update\n",
                    "RUN apt-get install nodejs yarn -y\n",
                    "RUN apt-get clean -y && apt-get -y autoremove && apt-get -y autoclean\n",
                ]
            )
        if app_build_type == "fromRepo":
            # image creation from repo
            build_commands.append(
                "WORKDIR /srv\n" f"RUN git clone {data['appRepoURL']} .\n"
            )
            if "revision" in data:
                build_commands.append(f"RUN git checkout {data['revision']}\n")
            image = self.create_app(
                service_name,
                data["notebookName"],
                build_commands,
            )
        elif app_build_type == "fromDockerImage":
            # service from existed docker image
            image = data["appImage"]
        elif app_build_type == "fromLocalDirectory":
            # image creation from path
            build_commands.append("COPY . /srv/\n")
            image = self.create_app(
                service_name,
                data["notebookName"],
                build_commands,
                data["appDir"],
            )
        else:
            raise "Not supported app type"
        # handle templates
        if data["appType"] == "voila":
            voila_options = "--Voila.ip='0.0.0.0' --port=8888 --no-browser"
            app_command = f"voila /srv/{data['notebookName']} {voila_options}"
        elif data["appType"] == "streamlit":
            streamlit_options = (
                "--server.port 8888 --server.headless true --server.address 0.0.0.0"
            )
            app_command = (
                f"streamlit run /srv/{data['pythonFileName']} {streamlit_options}"
            )
        elif data["appType"] == "jupyterlab":
            jlab_options = (
                "--no-browser --ip '0.0.0.0' --ContentsManager.allow_hidden=True"
            )
            app_command = f"jupyter lab {jlab_options}"
        else:
            raise Exception(f'Not supported app type {data["appType"]}')
        self.copy_templates(service_name, image, app_command, data)
        # git
        self.git_commit_and_push(service_name, service_repo_dir, app_build_type)
        repo_url = self.repo.remotes.origin.url
        if "@" in repo_url:
            repo_url = f"https://{repo_url.split('@')[-1]}"
        self.message = f"""
        service {service_name} submitted
        To folow: go to <a target='_blank' href='{repo_url}/actions'>{repo_url}/actions</a>
        """
