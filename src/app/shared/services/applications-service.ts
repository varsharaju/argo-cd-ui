import { Observable } from 'rxjs';

import * as models from '../models';
import requests from './requests';

export class ApplicationsService {
    public list(): Promise<models.Application[]> {
        return requests.get('/applications').then((res) => res.body as models.ApplicationList).then((list) => {
            return (list.items || []).map((app) => this.parseAppFields(app));
        });
    }

    public get(name: string): Promise<models.Application> {
        return requests.get(`/applications/${name}`).then((res) => this.parseAppFields(res.body));
    }

    public create(name: string, source: models.ApplicationSource, destination?: models.ApplicationDestination): Promise<models.Application> {
        return requests.post(`/applications`).send({
            metadata: { name },
            spec: { source, destination },
        }).then((res) => this.parseAppFields(res.body));
    }

    public delete(name: string, force: boolean): Promise<boolean> {
        return requests.delete(`/applications/${name}?force=${force}`).send({}).then(() => true);
    }

    public watch(query?: {name: string}): Observable<models.ApplicationWatchEvent> {
        let url = '/stream/applications';
        if (query) {
            url = `${url}?name=${query.name}`;
        }
        return requests.loadEventSource(url).repeat().retry().map((data) => JSON.parse(data).result as models.ApplicationWatchEvent).map((watchEvent) => {
            watchEvent.application = this.parseAppFields(watchEvent.application);
            return watchEvent;
        });
    }

    public sync(name: string, revision: string): Promise<boolean> {
        return requests.post(`/applications/${name}/sync`).send({revision}).then((res) => true);
    }

    public rollback(name: string, id: number): Promise<boolean> {
        return requests.post(`/applications/${name}/rollback`).send({id}).then((res) => true);
    }

    public getContainerLogs(applicationName: string, podName: string, containerName: string): Observable<models.LogEntry> {
        return requests.loadEventSource(`/applications/${applicationName}/pods/${podName}/logs?container=${containerName}&follow=true`).repeat().retry().map(
            (data) => JSON.parse(data).result as models.LogEntry);
    }

    public deletePod(applicationName: string, podName: string): Promise<any> {
        return requests.delete(`/applications/${applicationName}/pods/${podName}`).send().then((res) => true);
    }

    private parseAppFields(data: any): models.Application {
        const app = data as models.Application;
        (app.status.comparisonResult.resources || []).forEach((resource) => {
            resource.liveState = JSON.parse(resource.liveState as any);
            resource.targetState = JSON.parse(resource.targetState as any);
            function parseResourceNodes(node: models.ResourceNode) {
                node.state = JSON.parse(node.state as any);
                (node.children || []).forEach(parseResourceNodes);
            }
            (resource.childLiveResources || []).forEach((node) => {
                parseResourceNodes(node);
            });
        });
        app.kind = app.kind || 'Application';
        return app;
    }
}
