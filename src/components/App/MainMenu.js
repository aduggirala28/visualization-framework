import React from "react";
import { connect } from "react-redux";
import { push } from "redux-router";

import Drawer from "material-ui/Drawer";
import Subheader from "material-ui/Subheader";
import { List, ListItem } from "material-ui/List";

import {
    Actions as ComponentActions,
    ActionKeyStore as ComponentActionKeyStore
} from "./redux/actions";

import {
    Actions as ServiceActions,
    ActionKeyStore as ServiceActionKeyStore
} from "../../services/servicemanager/redux/actions";

import { theme } from "../../theme";

var style = {
    header: {
        textAlign: "center",
        color: "#ffffff",
    },
    nestedItems: {
        background: theme.palette.lightBlue,
        padding: 0,
    },
    nestedItem: {
        fontSize: "14px",
        paddingLeft: "16px",
        color: "#ffffff",
    },
    listItem: {
        color: "#ffffff",
    },
    subHeader: {
        color: "#ffffff",
    }
}

class MainMenuView extends React.Component {

    componentWillMount() {
        this.initialize();
    }

    componentWillReceiveProps(nextProps) {
        this.initialize();
    }

    initialize() {
        this.props.fetchEnterprisesIfNeeded().then((enterprises) => {
            // if (!enterprises)
            //     return;
            //
            // for (let index in enterprises) { // eslint-disable-line
            //     let enterprise = enterprises[index];
            //     this.props.fetchDomainsIfNeeded(enterprise.ID);
            // }
        });
    }

    renderSubTree() {
        const { enterprises } = this.props;

        if (!enterprises)
            return;

        return (
            <div>
                {enterprises.map((enterprise) => {
                    return (
                        <ListItem
                            key={enterprise.ID}
                            primaryText={enterprise.name}
                            style={style.listItem}
                        />
                    )
                })}
            </div>
        )
    }

    render() {
        return (
            <Drawer open={this.props.open} docked={false} onRequestChange={this.props.onRequestChange}>
                <div style={style.header}>
                    <p>Visualization Framework</p>
                    <img src="/src/favicon.ico" alt="icon" role="presentation" width="10%" height="10%" />
                </div>

                <Subheader style={style.subHeader}>Development</Subheader>
                <List>
                    <ListItem
                        primaryText="AppsOverview"
                        onTouchTap={() => {this.props.goTo("/dashboards/appsOverview?startTime=now-900h")}}
                        style={style.listItem}
                        />
                    <ListItem
                        primaryText="Dashboard1"
                        onTouchTap={() => {this.props.goTo("/dashboards/dashboard1")}}
                        style={style.listItem}
                        />
                </List>

                <Subheader style={style.subHeader}>Enterprises</Subheader>
                    <List>
                        {this.renderSubTree()}
                    </List>
            </Drawer>
        );
    }
}


MainMenuView.propTypes = {
  open: React.PropTypes.bool,
  onRequestChange: React.PropTypes.func,
};

const mapStateToProps = (state) => ({
    open: state.interface.get(ComponentActionKeyStore.MAIN_MENU_OPENED),
    enterprises: state.services.getIn([ServiceActionKeyStore.REQUESTS, 'enterprises', ServiceActionKeyStore.RESULTS]),
});

const actionCreators = (dispatch) => ({
  onRequestChange: () => {
      dispatch(ComponentActions.toggleMainMenu());
  },
  setPageTitle: (aTitle) => {
      dispatch(ComponentActions.updateTitle(aTitle));
  },
  goTo: (link) => {
      dispatch(ComponentActions.toggleMainMenu());
      dispatch(push(link));
  },
  fetchEnterprisesIfNeeded: () => {
      return dispatch(ServiceActions.fetchIfNeeded({
          parentResource: "enterprises"
      },
      "VSD"
      ));
  }
});


export default connect(mapStateToProps, actionCreators)(MainMenuView);
